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
 *    timeline messages when overlay-relevant fields differ (can run
 *    without an upsert for prediction-only ticks). Writes are assembled in
 *    `timelineEventAssembler` after this branch returns.
 * 4. **Early exit** — If nothing to upsert and no overlay work, return empty.
 * 5. **Batch upsert** — When needed, `upsertVesselTripsBatch` persists queued
 *    active trips in one mutation.
 * 6. **Success set** — Remember which vessels’ upserts succeeded.
 * 7. **Post-persist hooks** — Leave-dock depart-next backfill runs only after a
 *    successful upsert (never for projection-only ticks).
 * 8. **Return messages** — For the event assembler; items tied to an upsert
 *    carry `requiresSuccessfulUpsert` for filtering after step 5.
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import type {
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
} from "../projection/lifecycleEventTypes";
import { buildTrip } from "./buildTrip";
import { tripsEqualForOverlay, tripsEqualForStorage } from "./tripEquality";
import type { TripEvents } from "./tripEventTypes";

type CurrentTripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ConvexVesselTrip;
  events: TripEvents;
};

type CurrentTripBuildResult = CurrentTripTransition & {
  finalProposed: ConvexVesselTripWithML;
};

type PendingLeaveDockEffect = {
  vesselAbbrev: string;
  trip: ConvexVesselTripWithML;
};

type CurrentTripArtifacts = {
  activeUpserts: ConvexVesselTripWithML[];
  pendingActualMessages: CurrentTripActualEventMessage[];
  pendingPredictedMessages: CurrentTripPredictedEventMessage[];
  pendingLeaveDockEffects: PendingLeaveDockEffect[];
};

type UpsertBatchResult = {
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
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
 * @returns Upsert outcomes and messages for `timelineEventAssembler`
 */
export const processCurrentTrips = async (
  ctx: ActionCtx,
  currentTrips: CurrentTripTransition[],
  shouldRunPredictionFallback: boolean,
  buildTripForTick: typeof buildTrip = buildTrip
): Promise<CurrentTripLifecycleBranchResult> => {
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

  const collectedArtifacts = successfulBuildResults.reduce(
    mergeCurrentTripArtifacts,
    createEmptyCurrentTripArtifacts()
  );

  const hasTimelineMessageWork =
    collectedArtifacts.pendingActualMessages.length > 0 ||
    collectedArtifacts.pendingPredictedMessages.length > 0;

  if (
    collectedArtifacts.activeUpserts.length === 0 &&
    !hasTimelineMessageWork
  ) {
    return emptyCurrentTripBranchResult();
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

  await runLeaveDockPostPersistEffects(
    ctx,
    successfulVessels,
    collectedArtifacts.pendingLeaveDockEffects
  );

  return {
    successfulVessels,
    pendingActualMessages: collectedArtifacts.pendingActualMessages,
    pendingPredictedMessages: collectedArtifacts.pendingPredictedMessages,
  };
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
 * messages when overlay-relevant fields differ (independent of upsert).
 *
 * @param buildResult - Successful current-trip build result
 * @returns Array-backed artifacts suitable for reducer-based accumulation
 */
const collectCurrentTripArtifacts = (
  buildResult: CurrentTripBuildResult
): CurrentTripArtifacts => {
  const { existingTrip, currLocation, events, finalProposed } = buildResult;

  const persist = !tripsEqualForStorage(existingTrip, finalProposed);
  const refresh = !tripsEqualForOverlay(existingTrip, finalProposed);

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
    pendingActualMessages: refresh
      ? [
          {
            events,
            finalProposed,
            vesselAbbrev: currLocation.VesselAbbrev,
            requiresSuccessfulUpsert: upsertGate,
          },
        ]
      : [],
    pendingPredictedMessages: refresh
      ? [
          {
            existingTrip,
            finalProposed,
            vesselAbbrev: currLocation.VesselAbbrev,
            requiresSuccessfulUpsert: upsertGate,
          },
        ]
      : [],
    pendingLeaveDockEffects: leaveDockEffect !== null ? [leaveDockEffect] : [],
  };
};

/**
 * Builds the set of vessels whose batch upsert row succeeded.
 *
 * Failed rows log to `console.error` and are omitted from the set so downstream
 * timeline assembly and leave-dock hooks never run for a trip that did not persist.
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
    pendingActualMessages: [
      ...accumulated.pendingActualMessages,
      ...next.pendingActualMessages,
    ],
    pendingPredictedMessages: [
      ...accumulated.pendingPredictedMessages,
      ...next.pendingPredictedMessages,
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
  pendingActualMessages: [],
  pendingPredictedMessages: [],
  pendingLeaveDockEffects: [],
});

/**
 * Branch result when no upsert and no overlay work was queued.
 *
 * @returns Empty intents and no successful upserts
 */
const emptyCurrentTripBranchResult = (): CurrentTripLifecycleBranchResult => ({
  successfulVessels: new Set(),
  pendingActualMessages: [],
  pendingPredictedMessages: [],
});
