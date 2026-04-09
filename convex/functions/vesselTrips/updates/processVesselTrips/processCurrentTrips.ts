/**
 * Steady-state processing for vessels on the **active trip** path (no
 * trip-completion / replacement handoff — that lives in `processCompletedTrips`).
 *
 * ## Pipeline (one orchestrator tick)
 *
 * 1. **Parallel build** — Each vessel runs `buildTrip` under
 *    `Promise.allSettled` so one failure does not block the rest.
 * 2. **Keep successes** — Rejected builds are logged and discarded.
 * 3. **Collect artifacts** — Lifecycle upsert when strip-shaped row differs;
 *    timeline patches/effects when projection-relevant fields differ (can run
 *    without an upsert for prediction-only ticks).
 * 4. **Early exit** — If nothing to upsert and no overlay work, return empty.
 * 5. **Batch upsert** — When needed, `upsertVesselTripsBatch` persists queued
 *    active trips in one mutation.
 * 6. **Success set** — Remember which vessels’ upserts succeeded.
 * 7. **Post-persist hooks** — Leave-dock depart-next backfill runs only after a
 *    successful upsert (never for projection-only ticks).
 * 8. **Return projections** — Effects tied to an upsert are filtered by
 *    success; projection-only effects are emitted without an upsert gate.
 *
 * Patches and effects carry `vesselAbbrev` so step 8 can filter after step 5.
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import {
  buildPredictedBoundaryClearEffect,
  buildPredictedBoundaryProjectionEffect,
} from "domain/vesselTimeline/normalizedEvents";
import type { ConvexActualBoundaryPatch } from "functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryProjectionEffect } from "functions/eventsPredicted/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  buildArrivalActualPatchForTrip,
  buildDepartureActualPatchForTrip,
} from "../actualBoundaryPatchesFromTrip";
import { buildTrip } from "../buildTrip";
import type { TripEvents } from "../eventDetection";
import {
  shouldPersistLifecycleTrip,
  shouldRefreshTimelineProjection,
} from "../tripEquality";

type CurrentTripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ConvexVesselTrip;
  events: TripEvents;
};

type CurrentTripBuildResult = CurrentTripTransition & {
  finalProposed: ConvexVesselTripWithML;
};

type TaggedActualPatch = {
  vesselAbbrev: string;
  patch: ConvexActualBoundaryPatch;
  /** When true, drop if this vessel’s upsert failed or never ran. */
  requiresSuccessfulUpsert: boolean;
};

type TaggedPredictedEffect = {
  vesselAbbrev: string;
  effect: ConvexPredictedBoundaryProjectionEffect;
  /** When true, drop if this vessel’s upsert failed or never ran. */
  requiresSuccessfulUpsert: boolean;
};

type PendingLeaveDockEffect = {
  vesselAbbrev: string;
  trip: ConvexVesselTripWithML;
};

type CurrentTripArtifacts = {
  activeUpserts: ConvexVesselTripWithML[];
  pendingActualPatches: TaggedActualPatch[];
  pendingPredictedEffects: TaggedPredictedEffect[];
  pendingLeaveDockEffects: PendingLeaveDockEffect[];
};

type UpsertBatchResult = {
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
};

type ProjectionResults = {
  actualPatches: ConvexActualBoundaryPatch[];
  predictedEffects: ConvexPredictedBoundaryProjectionEffect[];
};

/**
 * Warn when live `AtDock` / `LeftDock` signals look inconsistent (feed quality).
 *
 * @param existingTrip - Previously persisted trip for the vessel, if any
 * @param currLocation - Current location payload being processed
 */
const logDockSignalDisagreement = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): void => {
  const hasLeftDockSignal =
    currLocation.LeftDock !== undefined || existingTrip?.LeftDock !== undefined;

  if (!currLocation.AtDock && currLocation.LeftDock === undefined) {
    console.warn(
      `[VesselTrips] AtDock false without LeftDock for ${currLocation.VesselAbbrev} at ${new Date(
        currLocation.TimeStamp
      ).toISOString()}`
    );
  }

  if (currLocation.AtDock && hasLeftDockSignal) {
    console.warn(
      `[VesselTrips] AtDock true while LeftDock is present for ${currLocation.VesselAbbrev} at ${new Date(
        currLocation.TimeStamp
      ).toISOString()}`
    );
  }

  if (
    existingTrip &&
    existingTrip.AtDock === false &&
    existingTrip.LeftDock === undefined &&
    currLocation.AtDock &&
    currLocation.LeftDock === undefined
  ) {
    console.warn(
      `[VesselTrips] AtDock reset before LeftDock appeared for ${currLocation.VesselAbbrev} between ${new Date(
        existingTrip.TimeStamp
      ).toISOString()} and ${new Date(currLocation.TimeStamp).toISOString()}`
    );
  }
};

/**
 * Runs the active-trip pipeline for one orchestrator tick.
 *
 * Step-by-step flow is documented inline below; see the module header for
 * end-to-end context and invariants.
 *
 * @param ctx - Convex action context
 * @param currentTrips - Current-trip transitions for this tick
 * @param shouldRunPredictionFallback - Whether the current tick is in the fallback window
 * @param buildTripForTick - Trip builder (defaults to real `buildTrip`; tests may pass a stub)
 * @returns Projection payloads safe to merge after persistence
 */
export const processCurrentTrips = async (
  ctx: ActionCtx,
  currentTrips: CurrentTripTransition[],
  shouldRunPredictionFallback: boolean,
  buildTripForTick: typeof buildTrip = buildTrip
): Promise<ProjectionResults> => {
  // Parallel per-vessel buildTrip; one rejection does not cancel siblings.
  const buildResults = await Promise.allSettled(
    currentTrips.map(async (transition) => {
      logDockSignalDisagreement(
        transition.existingTrip,
        transition.currLocation
      );
      return {
        ...transition,
        finalProposed: await buildTripForTick(
          ctx,
          transition.currLocation,
          transition.existingTrip,
          false,
          transition.events,
          shouldRunPredictionFallback
        ),
      };
    })
  );

  // Fulfilled builds only; log each rejection and drop that vessel from the batch.
  const successfulBuildResults = buildResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }
    console.error(
      "[VesselTrips] buildTrip failed for current-trip batch entry",
      { index, transition: currentTrips[index], reason: result.reason }
    );
    return [];
  });

  // One batch payload: upserts plus tagged patches, effects, leave-dock queue.
  const collectedArtifacts = successfulBuildResults.reduce(
    mergeCurrentTripArtifacts,
    createEmptyCurrentTripArtifacts()
  );

  const hasProjectionWork =
    collectedArtifacts.pendingActualPatches.length > 0 ||
    collectedArtifacts.pendingPredictedEffects.length > 0;

  if (collectedArtifacts.activeUpserts.length === 0 && !hasProjectionWork) {
    return emptyProjectionResults();
  }

  const successfulVessels =
    collectedArtifacts.activeUpserts.length > 0
      ? getSuccessfulVessels(
          await ctx.runMutation(
            api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
            { activeUpserts: collectedArtifacts.activeUpserts }
          )
        )
      : new Set<string>();

  // Depart-next backfill only after durable write; skipped for failed upserts.
  await runLeaveDockPostPersistEffects(
    ctx,
    successfulVessels,
    collectedArtifacts.pendingLeaveDockEffects
  );

  return {
    actualPatches: filterTaggedActualPatches(
      collectedArtifacts.pendingActualPatches,
      successfulVessels
    ),
    predictedEffects: filterTaggedPredictedEffects(
      collectedArtifacts.pendingPredictedEffects,
      successfulVessels
    ),
  };
};

/**
 * Returns whether stale predicted boundary rows should be cleared.
 *
 * When any of these differ, the prior trip identity no longer owns the
 * prediction scope:
 *
 * 1. `SailingDay`
 * 2. Segment `Key`
 * 3. `NextKey` (next-leg hint)
 *
 * @param existingTrip - Previously persisted active trip, if one exists
 * @param finalProposed - Newly built trip state for this tick
 * @returns True when the trip identity scope changed
 */
const shouldClearExistingPredictions = (
  existingTrip: ConvexVesselTrip | undefined,
  finalProposed: ConvexVesselTripWithML
): boolean =>
  existingTrip !== undefined &&
  (existingTrip.SailingDay !== finalProposed.SailingDay ||
    existingTrip.Key !== finalProposed.Key ||
    existingTrip.NextKey !== finalProposed.NextKey);

/**
 * Builds tagged predicted boundary effects for one vessel’s write candidate.
 *
 * Produces up to two effects (each builder may return `null` if the trip cannot
 * be scoped), tagged with whether upsert success is required:
 *
 * 1. **Project** — `buildPredictedBoundaryProjectionEffect(finalProposed)` for
 *    the new trip state.
 * 2. **Clear** — `buildPredictedBoundaryClearEffect(existingTrip)` when
 *    `shouldClearExistingPredictions` is true (old sailing day, segment key, or
 *    next-leg key).
 *
 * @param existingTrip - Previously persisted active trip, if one exists
 * @param finalProposed - Newly built trip state for this tick
 * @param vesselAbbrev - Vessel abbreviation for effect tagging
 * @param requiresSuccessfulUpsert - When true, omit if upsert failed or skipped
 * @returns Tagged predicted effects for this tick
 */
const buildPredictedEffectsForCurrentTrip = (
  existingTrip: ConvexVesselTrip | undefined,
  finalProposed: ConvexVesselTripWithML,
  vesselAbbrev: string,
  requiresSuccessfulUpsert: boolean
): TaggedPredictedEffect[] => {
  const effects: ConvexPredictedBoundaryProjectionEffect[] = [];

  const projection = buildPredictedBoundaryProjectionEffect(finalProposed);
  if (projection !== null) {
    effects.push(projection);
  }

  if (
    existingTrip !== undefined &&
    shouldClearExistingPredictions(existingTrip, finalProposed)
  ) {
    const clear = buildPredictedBoundaryClearEffect(existingTrip);
    if (clear !== null) {
      effects.push(clear);
    }
  }

  return effects.map((effect) => ({
    vesselAbbrev,
    effect,
    requiresSuccessfulUpsert,
  }));
};

/**
 * Builds tagged sparse actual boundary patches for `eventsActual`.
 *
 * 1. **Departure** when `didJustLeaveDock` and `LeftDock` are set: may emit a
 *    `dep-dock` patch if `buildDepartureActualPatchForTrip` has enough fields.
 * 2. **Arrival** when `didJustArriveAtDock` and `ArriveDest` are set: may emit an
 *    `arv-dock` patch if `buildArrivalActualPatchForTrip` has enough fields.
 *
 * @param events - Detected events for the current tick
 * @param finalProposed - Newly built trip state for this tick
 * @param vesselAbbrev - Vessel abbreviation for patch tagging
 * @param requiresSuccessfulUpsert - When true, omit if upsert failed or skipped
 * @returns Tagged actual patches for this tick
 */
const buildActualPatchesForCurrentTrip = (
  events: TripEvents,
  finalProposed: ConvexVesselTripWithML,
  vesselAbbrev: string,
  requiresSuccessfulUpsert: boolean
): TaggedActualPatch[] => {
  const patches: ConvexActualBoundaryPatch[] = [];
  if (events.didJustLeaveDock && finalProposed.LeftDock !== undefined) {
    const departure = buildDepartureActualPatchForTrip(finalProposed);
    if (departure !== null) {
      patches.push(departure);
    }
  }
  if (events.didJustArriveAtDock && finalProposed.ArriveDest !== undefined) {
    const arrival = buildArrivalActualPatchForTrip(finalProposed);
    if (arrival !== null) {
      patches.push(arrival);
    }
  }
  return patches.map((patch) => ({
    vesselAbbrev,
    patch,
    requiresSuccessfulUpsert,
  }));
};

/**
 * Queues leave-dock work that must run only after the active trip upsert.
 *
 * When the tick confirms leave-dock (`didJustLeaveDock` and `LeftDock`),
 * returns `{ vesselAbbrev, trip }` for `runLeaveDockPostPersistEffects`. The
 * prediction pipeline expects the trip row to exist in Convex first, so this is
 * never invoked inline during the build phase.
 *
 * @param events - Detected events for the current tick
 * @param finalProposed - Newly built trip state for this tick
 * @param vesselAbbrev - Vessel abbreviation for effect tagging
 * @returns Pending leave-dock effect, or null when none should run
 */
const buildLeaveDockPostPersistEffect = (
  events: TripEvents,
  finalProposed: ConvexVesselTripWithML,
  vesselAbbrev: string
): PendingLeaveDockEffect | null =>
  events.didJustLeaveDock && finalProposed.LeftDock !== undefined
    ? {
        vesselAbbrev,
        trip: finalProposed,
      }
    : null;

/**
 * Turns one fulfilled build into batch upsert and side-effect queues.
 *
 * When neither lifecycle persistence nor timeline refresh applies, returns empty
 * lists. Otherwise queues upserts only when the strip-shaped row differs;
 * overlays when projection-relevant fields differ (independent of upsert).
 *
 * @param buildResult - Successful current-trip build result
 * @returns Array-backed artifacts suitable for reducer-based accumulation
 */
const collectCurrentTripArtifacts = (
  buildResult: CurrentTripBuildResult
): CurrentTripArtifacts => {
  const { existingTrip, currLocation, events, finalProposed } = buildResult;

  const persist = shouldPersistLifecycleTrip(existingTrip, finalProposed);
  const refresh = shouldRefreshTimelineProjection(existingTrip, finalProposed);

  if (!persist && !refresh) {
    return createEmptyCurrentTripArtifacts();
  }

  const leaveDockEffect = persist
    ? buildLeaveDockPostPersistEffect(
        events,
        finalProposed,
        currLocation.VesselAbbrev
      )
    : null;

  const upsertGate = persist;

  return {
    activeUpserts: persist ? [finalProposed] : [],
    pendingActualPatches: refresh
      ? buildActualPatchesForCurrentTrip(
          events,
          finalProposed,
          currLocation.VesselAbbrev,
          upsertGate
        )
      : [],
    pendingPredictedEffects: refresh
      ? buildPredictedEffectsForCurrentTrip(
          existingTrip,
          finalProposed,
          currLocation.VesselAbbrev,
          upsertGate
        )
      : [],
    pendingLeaveDockEffects: leaveDockEffect !== null ? [leaveDockEffect] : [],
  };
};

/**
 * Builds the set of vessels whose batch upsert row succeeded.
 *
 * Failed rows log to `console.error` and are omitted from the set so downstream
 * projection and leave-dock hooks never run for a trip that did not persist.
 *
 * @param upsertResult - Per-vessel batch upsert result from the mutation
 * @returns Set of vessel abbreviations with successful upserts
 */
const getSuccessfulVessels = (upsertResult: UpsertBatchResult): Set<string> =>
  new Set(
    upsertResult.perVessel
      .filter((result) => {
        if (result.ok) {
          return true;
        }

        console.error(
          `[VesselTrips] Failed active-trip upsert for ${result.vesselAbbrev}: ${
            result.reason ?? "unknown error"
          }`
        );
        return false;
      })
      .map((result) => result.vesselAbbrev)
  );

/**
 * Keeps patches that either do not require an upsert or passed upsert success.
 *
 * @param tagged - Tagged patches gathered during build processing
 * @param successfulVessels - Set of vessels with successful upserts
 * @returns Untagged patches safe to project
 */
const filterTaggedActualPatches = (
  tagged: TaggedActualPatch[],
  successfulVessels: Set<string>
): ConvexActualBoundaryPatch[] =>
  tagged
    .filter(
      (t) =>
        !t.requiresSuccessfulUpsert || successfulVessels.has(t.vesselAbbrev)
    )
    .map((t) => t.patch);

/**
 * Keeps effects that either do not require an upsert or passed upsert success.
 *
 * @param tagged - Tagged predicted effects gathered during build processing
 * @param successfulVessels - Set of vessels with successful upserts
 * @returns Untagged effects safe to project
 */
const filterTaggedPredictedEffects = (
  tagged: TaggedPredictedEffect[],
  successfulVessels: Set<string>
): ConvexPredictedBoundaryProjectionEffect[] =>
  tagged
    .filter(
      (t) =>
        !t.requiresSuccessfulUpsert || successfulVessels.has(t.vesselAbbrev)
    )
    .map((t) => t.effect);

/**
 * Backfills depart-next prediction actuals on the most recent completed trip
 * after a successful active-trip upsert when the vessel just left dock.
 *
 * Uses `setDepartNextActualsForMostRecentCompletedTrip` with the new trip's
 * `LeftDock` timestamp. Errors are logged per vessel; one failure does not
 * block others (`Promise.allSettled`).
 *
 * @param ctx - Convex action context
 * @param successfulVessels - Set of vessels with successful upserts
 * @param pendingLeaveDockEffects - Leave-dock effects gathered during build processing
 * @returns Promise that resolves once all side effects settle
 */
const runLeaveDockPostPersistEffects = async (
  ctx: ActionCtx,
  successfulVessels: Set<string>,
  pendingLeaveDockEffects: PendingLeaveDockEffect[]
): Promise<void> => {
  await Promise.allSettled(
    pendingLeaveDockEffects
      .filter((effect) => successfulVessels.has(effect.vesselAbbrev))
      .map(async (effect) => {
        try {
          const leftDockMs = effect.trip.LeftDock;
          if (leftDockMs === undefined) {
            return;
          }

          await ctx.runMutation(
            api.functions.vesselTrips.mutations
              .setDepartNextActualsForMostRecentCompletedTrip,
            {
              vesselAbbrev: effect.vesselAbbrev,
              actualDepartMs: leftDockMs,
            }
          );
        } catch (error) {
          console.error("[VesselTrips] leave-dock post-persist failed", {
            vesselAbbrev: effect.vesselAbbrev,
            trip: effect.trip,
            error,
          });
        }
      })
  );
};

/**
 * Reducer step: appends one vessel’s artifacts to the running batch.
 *
 * `collectCurrentTripArtifacts` may return all empty arrays when that vessel
 * needs no lifecycle upsert and no timeline projection work; those are
 * concatenated as no-ops.
 *
 * @param accumulated - Running accumulator for all successful build results
 * @param buildResult - Successful current-trip build result
 * @returns Merged artifacts accumulator
 */
const mergeCurrentTripArtifacts = (
  accumulated: CurrentTripArtifacts,
  buildResult: CurrentTripBuildResult
): CurrentTripArtifacts => {
  const next = collectCurrentTripArtifacts(buildResult);

  return {
    activeUpserts: [...accumulated.activeUpserts, ...next.activeUpserts],
    pendingActualPatches: [
      ...accumulated.pendingActualPatches,
      ...next.pendingActualPatches,
    ],
    pendingPredictedEffects: [
      ...accumulated.pendingPredictedEffects,
      ...next.pendingPredictedEffects,
    ],
    pendingLeaveDockEffects: [
      ...accumulated.pendingLeaveDockEffects,
      ...next.pendingLeaveDockEffects,
    ],
  };
};

/**
 * Initial value for `reduce` when folding vessels into one batch.
 *
 * @returns Empty accumulator for reducer-based collection
 */
const createEmptyCurrentTripArtifacts = (): CurrentTripArtifacts => ({
  activeUpserts: [],
  pendingActualPatches: [],
  pendingPredictedEffects: [],
  pendingLeaveDockEffects: [],
});

/**
 * Projection payload when no overlay work was queued for the current branch.
 *
 * @returns Empty actual/predicted projection result object
 */
const emptyProjectionResults = (): ProjectionResults => ({
  actualPatches: [],
  predictedEffects: [],
});
