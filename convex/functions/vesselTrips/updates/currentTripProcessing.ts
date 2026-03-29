/**
 * Current-trip processing helpers for vessel trip updates.
 *
 * Keeps the steady-state active-trip path separate from the top-level updater
 * while preserving the existing persistence and post-persist sequencing rules.
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { handlePredictionEvent } from "domain/ml/prediction";
import {
  buildPredictedBoundaryClearEffect,
  buildPredictedBoundaryProjectionEffect,
} from "domain/vesselTimeline/normalizedEvents";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexActualBoundaryEffect } from "functions/vesselTimeline/actualEffects";
import type { ConvexPredictedBoundaryProjectionEffect } from "functions/vesselTimeline/predictedEffects";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildTrip } from "./buildTrip";
import type { TripEvents } from "./eventDetection";
import { tripsAreEqual } from "./utils";

type CurrentTripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ConvexVesselTrip;
  events: TripEvents;
};

type CurrentTripBuildResult = CurrentTripTransition & {
  finalProposed: ConvexVesselTrip;
};

type TaggedActualEffect = {
  vesselAbbrev: string;
  effect: ConvexActualBoundaryEffect;
};

type TaggedPredictedEffect = {
  vesselAbbrev: string;
  effect: ConvexPredictedBoundaryProjectionEffect;
};

type PendingLeaveDockEffect = {
  vesselAbbrev: string;
  trip: ConvexVesselTrip;
};

type CurrentTripArtifacts = {
  activeUpserts: ConvexVesselTrip[];
  pendingActualEffects: TaggedActualEffect[];
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

type CurrentTripProcessingCallbacks = {
  logDockSignalDisagreement: (
    existingTrip: ConvexVesselTrip | undefined,
    currLocation: ConvexVesselLocation
  ) => void;
  logVesselProcessingError: (
    vesselAbbrev: string,
    phase: string,
    error: unknown
  ) => void;
};

export type ProjectionResults = {
  actualEffects: ConvexActualBoundaryEffect[];
  predictedEffects: ConvexPredictedBoundaryProjectionEffect[];
};

export type CurrentTripProcessingDeps = {
  buildTrip: typeof buildTrip;
  handlePredictionEvent: typeof handlePredictionEvent;
};

const DEFAULT_CURRENT_TRIP_PROCESSING_DEPS: CurrentTripProcessingDeps = {
  buildTrip,
  handlePredictionEvent,
};

/**
 * Process current trips that remain on the same active trip record.
 *
 * @param ctx - Convex action context
 * @param currentTrips - Current-trip transitions for this tick
 * @param shouldRunPredictionFallback - Whether the current tick is in the fallback window
 * @param callbacks - Logging callbacks owned by the top-level updater
 * @param deps - Injectable helpers for trip building and prediction side effects
 * @returns Projection effects derived from successfully persisted active trips
 */
export const processCurrentTrips = async (
  ctx: ActionCtx,
  currentTrips: CurrentTripTransition[],
  shouldRunPredictionFallback: boolean,
  callbacks: CurrentTripProcessingCallbacks,
  deps: CurrentTripProcessingDeps = DEFAULT_CURRENT_TRIP_PROCESSING_DEPS
): Promise<ProjectionResults> => {
  const buildResults = await Promise.allSettled(
    currentTrips.map((transition) =>
      buildCurrentTripResult(
        ctx,
        transition,
        shouldRunPredictionFallback,
        callbacks.logDockSignalDisagreement,
        deps.buildTrip
      )
    )
  );
  const successfulBuildResults = normalizeCurrentTripBuildResults(
    currentTrips,
    buildResults,
    callbacks.logVesselProcessingError
  );
  const collectedArtifacts = successfulBuildResults.reduce(
    mergeCurrentTripArtifacts,
    createEmptyCurrentTripArtifacts()
  );

  // Side effects stay gated on the batch upsert so projections never outrun persistence.
  if (collectedArtifacts.activeUpserts.length === 0) {
    return emptyProjectionResults();
  }

  const upsertResult = await ctx.runMutation(
    api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
    { activeUpserts: collectedArtifacts.activeUpserts }
  );
  const successfulVessels = getSuccessfulVessels(upsertResult);

  await runLeaveDockPostPersistEffects(
    ctx,
    successfulVessels,
    collectedArtifacts.pendingLeaveDockEffects,
    callbacks.logVesselProcessingError,
    deps.handlePredictionEvent
  );

  return {
    actualEffects: filterEffectsForSuccessfulVessels(
      collectedArtifacts.pendingActualEffects,
      successfulVessels
    ),
    predictedEffects: filterEffectsForSuccessfulVessels(
      collectedArtifacts.pendingPredictedEffects,
      successfulVessels
    ),
  };
};

/**
 * Decide whether the proposed trip should be persisted.
 *
 * @param existingTrip - Previously persisted active trip, if one exists
 * @param finalProposed - Newly built trip state for this tick
 * @returns True when the trip is new or meaningfully changed
 */
const shouldWriteCurrentTrip = (
  existingTrip: ConvexVesselTrip | undefined,
  finalProposed: ConvexVesselTrip
): boolean => !existingTrip || !tripsAreEqual(existingTrip, finalProposed);

/**
 * Decide whether the previous predicted boundary scope should be cleared.
 *
 * @param existingTrip - Previously persisted active trip, if one exists
 * @param finalProposed - Newly built trip state for this tick
 * @returns True when the trip identity scope changed
 */
const shouldClearExistingPredictions = (
  existingTrip: ConvexVesselTrip | undefined,
  finalProposed: ConvexVesselTrip
): boolean =>
  existingTrip !== undefined &&
  (existingTrip.SailingDay !== finalProposed.SailingDay ||
    existingTrip.Key !== finalProposed.Key ||
    existingTrip.NextKey !== finalProposed.NextKey);

/**
 * Build predicted projection effects for a current-trip write candidate.
 *
 * @param existingTrip - Previously persisted active trip, if one exists
 * @param finalProposed - Newly built trip state for this tick
 * @param vesselAbbrev - Vessel abbreviation for effect tagging
 * @returns Tagged predicted effects to queue after a successful upsert
 */
const buildPredictedEffectsForCurrentTrip = (
  existingTrip: ConvexVesselTrip | undefined,
  finalProposed: ConvexVesselTrip,
  vesselAbbrev: string
): TaggedPredictedEffect[] =>
  [
    buildPredictedBoundaryProjectionEffect(finalProposed),
    shouldClearExistingPredictions(existingTrip, finalProposed) && existingTrip
      ? buildPredictedBoundaryClearEffect(existingTrip)
      : null,
  ]
    .filter((effect): effect is ConvexPredictedBoundaryProjectionEffect =>
      Boolean(effect)
    )
    .map((effect) => ({
      vesselAbbrev,
      effect,
    }));

/**
 * Build actual projection effects for a current-trip write candidate.
 *
 * @param events - Detected events for the current tick
 * @param finalProposed - Newly built trip state for this tick
 * @param vesselAbbrev - Vessel abbreviation for effect tagging
 * @returns Tagged actual effects to queue after a successful upsert
 */
const buildActualEffectsForCurrentTrip = (
  events: TripEvents,
  finalProposed: ConvexVesselTrip,
  vesselAbbrev: string
): TaggedActualEffect[] =>
  [
    events.didJustLeaveDock && finalProposed.LeftDock !== undefined
      ? buildDepartureActualEffect(finalProposed)
      : null,
    events.didJustArriveAtDock && finalProposed.ArriveDest !== undefined
      ? buildArrivalActualEffect(finalProposed)
      : null,
  ]
    .filter((effect): effect is ConvexActualBoundaryEffect => Boolean(effect))
    .map((effect) => ({
      vesselAbbrev,
      effect,
    }));

/**
 * Build a leave-dock post-persist effect when the vessel has just departed.
 *
 * @param events - Detected events for the current tick
 * @param finalProposed - Newly built trip state for this tick
 * @param vesselAbbrev - Vessel abbreviation for effect tagging
 * @returns Pending leave-dock effect, or null when none should run
 */
const buildLeaveDockPostPersistEffect = (
  events: TripEvents,
  finalProposed: ConvexVesselTrip,
  vesselAbbrev: string
): PendingLeaveDockEffect | null =>
  events.didJustLeaveDock && finalProposed.LeftDock !== undefined
    ? {
        vesselAbbrev,
        trip: finalProposed,
      }
    : null;

/**
 * Collect all upsert and side-effect artifacts for one current-trip build result.
 *
 * @param buildResult - Successful current-trip build result
 * @returns Array-backed artifacts suitable for reducer-based accumulation
 */
const collectCurrentTripArtifacts = (
  buildResult: CurrentTripBuildResult
): CurrentTripArtifacts => {
  const { existingTrip, currLocation, events, finalProposed } = buildResult;

  if (!shouldWriteCurrentTrip(existingTrip, finalProposed)) {
    return createEmptyCurrentTripArtifacts();
  }

  const leaveDockEffect = buildLeaveDockPostPersistEffect(
    events,
    finalProposed,
    currLocation.VesselAbbrev
  );

  return {
    activeUpserts: [finalProposed],
    pendingActualEffects: buildActualEffectsForCurrentTrip(
      events,
      finalProposed,
      currLocation.VesselAbbrev
    ),
    pendingPredictedEffects: buildPredictedEffectsForCurrentTrip(
      existingTrip,
      finalProposed,
      currLocation.VesselAbbrev
    ),
    pendingLeaveDockEffects: leaveDockEffect ? [leaveDockEffect] : [],
  };
};

/**
 * Derive the set of vessels whose active-trip upsert succeeded.
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
 * Filter tagged effects down to only those whose upsert succeeded.
 *
 * @param effects - Tagged effects gathered during build processing
 * @param successfulVessels - Set of vessels with successful upserts
 * @returns Untagged effects safe to project
 */
const filterEffectsForSuccessfulVessels = <TEffect>(
  effects: Array<{ vesselAbbrev: string; effect: TEffect }>,
  successfulVessels: Set<string>
): TEffect[] =>
  effects
    .filter((effect) => successfulVessels.has(effect.vesselAbbrev))
    .map((effect) => effect.effect);

/**
 * Run leave-dock post-persist side effects for successfully upserted vessels.
 *
 * @param ctx - Convex action context
 * @param successfulVessels - Set of vessels with successful upserts
 * @param pendingLeaveDockEffects - Leave-dock effects gathered during build processing
 * @param logVesselProcessingError - Error logger owned by the top-level updater
 * @param handlePredictionEventFn - Prediction event handler to run post-persist
 * @returns Promise that resolves once all side effects settle
 */
const runLeaveDockPostPersistEffects = async (
  ctx: ActionCtx,
  successfulVessels: Set<string>,
  pendingLeaveDockEffects: PendingLeaveDockEffect[],
  logVesselProcessingError: (
    vesselAbbrev: string,
    phase: string,
    error: unknown
  ) => void,
  handlePredictionEventFn: typeof handlePredictionEvent
): Promise<void> => {
  await Promise.allSettled(
    pendingLeaveDockEffects
      .filter((effect) => successfulVessels.has(effect.vesselAbbrev))
      .map(async (effect) => {
        try {
          const previousTripResult = await ctx.runQuery(
            api.functions.vesselTrips.queries.getMostRecentCompletedTrip,
            { vesselAbbrev: effect.vesselAbbrev }
          );
          const previousTrip = previousTripResult ?? undefined;

          await handlePredictionEventFn(ctx, {
            eventType: "leave_dock",
            trip: effect.trip,
            previousTrip,
          });
        } catch (error) {
          logVesselProcessingError(
            effect.vesselAbbrev,
            "leave-dock post-persist side effects",
            error
          );
        }
      })
  );
};

/**
 * Build one current-trip result by enriching the latest location update.
 *
 * @param ctx - Convex action context
 * @param transition - Current-trip transition to build
 * @param shouldRunPredictionFallback - Whether the current tick is in the fallback window
 * @param logDockSignalDisagreement - Dock-signal logger owned by the top-level updater
 * @param buildTripFn - Trip builder used to enrich the current location tick
 * @returns Built current-trip result ready for write/effect decisions
 */
const buildCurrentTripResult = async (
  ctx: ActionCtx,
  transition: CurrentTripTransition,
  shouldRunPredictionFallback: boolean,
  logDockSignalDisagreement: (
    existingTrip: ConvexVesselTrip | undefined,
    currLocation: ConvexVesselLocation
  ) => void,
  buildTripFn: typeof buildTrip
): Promise<CurrentTripBuildResult> => {
  logDockSignalDisagreement(transition.existingTrip, transition.currLocation);

  return {
    ...transition,
    finalProposed: await buildTripFn(
      ctx,
      transition.currLocation,
      transition.existingTrip,
      transition.events.shouldStartTrip,
      transition.events,
      shouldRunPredictionFallback
    ),
  };
};

/**
 * Normalize settled current-trip build results and log any failures.
 *
 * @param currentTrips - Original transition list
 * @param buildResults - Settled build results in input order
 * @param logVesselProcessingError - Error logger owned by the top-level updater
 * @returns Successful build results only
 */
const normalizeCurrentTripBuildResults = (
  currentTrips: CurrentTripTransition[],
  buildResults: PromiseSettledResult<CurrentTripBuildResult>[],
  logVesselProcessingError: (
    vesselAbbrev: string,
    phase: string,
    error: unknown
  ) => void
): CurrentTripBuildResult[] =>
  buildResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    const transition = currentTrips[index];
    logVesselProcessingError(
      transition?.currLocation.VesselAbbrev ?? "unknown",
      "current-trip processing",
      result.reason
    );
    return [];
  });

/**
 * Merge one build result's artifacts into the accumulator.
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
    pendingActualEffects: [
      ...accumulated.pendingActualEffects,
      ...next.pendingActualEffects,
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
 * Create an empty current-trip artifacts accumulator.
 *
 * @returns Empty accumulator for reducer-based collection
 */
const createEmptyCurrentTripArtifacts = (): CurrentTripArtifacts => ({
  activeUpserts: [],
  pendingActualEffects: [],
  pendingPredictedEffects: [],
  pendingLeaveDockEffects: [],
});

/**
 * Create an empty projection result.
 *
 * @returns Empty actual/predicted projection result object
 */
const emptyProjectionResults = (): ProjectionResults => ({
  actualEffects: [],
  predictedEffects: [],
});

/**
 * Build the actual departure projection effect for a finalized trip state.
 *
 * @param trip - Finalized trip carrying a canonical segment key and departure time
 * @returns Departure effect, or null when the trip is not projection-ready
 */
const buildDepartureActualEffect = (
  trip: ConvexVesselTrip
): ConvexActualBoundaryEffect | null => {
  if (
    !trip.Key ||
    !trip.SailingDay ||
    trip.ScheduledDeparture === undefined ||
    trip.LeftDock === undefined
  ) {
    return null;
  }

  return {
    SegmentKey: trip.Key,
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.DepartingTerminalAbbrev,
    EventType: "dep-dock",
    EventActualTime: trip.LeftDock,
  };
};

/**
 * Build the actual arrival projection effect for a finalized trip state.
 *
 * @param trip - Finalized trip carrying a canonical segment key and arrival time
 * @returns Arrival effect, or null when the trip is not projection-ready
 */
const buildArrivalActualEffect = (
  trip: ConvexVesselTrip
): ConvexActualBoundaryEffect | null => {
  if (
    !trip.Key ||
    !trip.SailingDay ||
    trip.ScheduledDeparture === undefined ||
    trip.ArriveDest === undefined ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return null;
  }

  return {
    SegmentKey: trip.Key,
    VesselAbbrev: trip.VesselAbbrev,
    SailingDay: trip.SailingDay,
    ScheduledDeparture: trip.ScheduledDeparture,
    TerminalAbbrev: trip.ArrivingTerminalAbbrev,
    EventType: "arv-dock",
    EventActualTime: trip.ArriveDest,
  };
};
