/**
 * Vessel-trip processing entrypoint.
 *
 * Coordinates trip-boundary detection, active-trip persistence, and
 * VesselTimeline projection writes for each vessel tick.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildCompletedTrip } from "../buildCompletedTrip";
import { buildTrip } from "../buildTrip";
import {
  assertSequentialLifecycleOrder,
  buildLifecycleCommands,
  buildTripTickPlan,
  mergeProjectionBatches,
} from "../contracts";
import type { TripEvents } from "../eventDetection";
import { detectTripEvents } from "../eventDetection";
import {
  buildProjectionBatchFromCompletedFacts,
  buildProjectionBatchFromCurrentIntents,
} from "../timelineProjectionProjector";
import {
  type ProcessCompletedTripsDeps,
  processCompletedTrips,
} from "./processCompletedTrips";
import { processCurrentTrips } from "./processCurrentTrips";

// Restrict time-based retries to the first few seconds of each minute.
const PREDICTION_FALLBACK_WINDOW_SECONDS = 5;

type TripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ConvexVesselTrip;
  events: TripEvents;
};

type CompletedTripTransition = TripTransition & {
  existingTrip: ConvexVesselTrip;
};

type ProcessVesselTripsDeps = ProcessCompletedTripsDeps & {
  detectTripEvents: typeof detectTripEvents;
};

const DEFAULT_PROCESS_VESSEL_TRIPS_DEPS: ProcessVesselTripsDeps = {
  buildCompletedTrip,
  buildTrip,
  detectTripEvents,
};

/**
 * Process vessel trips for one orchestrator tick.
 *
 * Builds a per-vessel transition object once, categorizes transitions by trip
 * boundary, then delegates to processing functions that handle persistence.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process after orchestrator conversion
 * @param tickStartedAt - Tick timestamp owned by VesselOrchestrator
 * @param activeTrips - When set (e.g. from orchestrator bundled read), skips a
 *   separate `getActiveTrips` query for this tick
 * @returns Promise that resolves once the update pass completes
 */
export const processVesselTrips = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[],
  tickStartedAt: number,
  activeTrips?: ConvexVesselTrip[]
): Promise<void> => {
  await processVesselTripsWithDeps(
    ctx,
    locations,
    tickStartedAt,
    DEFAULT_PROCESS_VESSEL_TRIPS_DEPS,
    activeTrips
  );
};

/**
 * Process vessel trips with injectable dependencies.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process after orchestrator conversion
 * @param tickStartedAt - Tick timestamp owned by VesselOrchestrator
 * @param deps - Internal dependency bag used for testability
 * @param activeTrips - When set, used instead of loading active trips via
 *   `getActiveTrips`
 * @returns Promise that resolves after all trip updates and projections complete
 */
export const processVesselTripsWithDeps = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[],
  tickStartedAt: number,
  deps: ProcessVesselTripsDeps,
  activeTrips?: ConvexVesselTrip[]
): Promise<void> => {
  const existingTripsList =
    activeTrips ??
    (await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips));

  const existingTripsDict = Object.fromEntries(
    (existingTripsList ?? []).map(
      (trip: ConvexVesselTrip) => [trip.VesselAbbrev, trip] as const
    )
  ) as Record<string, ConvexVesselTrip>;

  // Use the orchestrator-owned tick time so all vessels share the same window.
  const shouldRunPredictionFallback =
    new Date(tickStartedAt).getSeconds() < PREDICTION_FALLBACK_WINDOW_SECONDS;

  const tripTickPlan = buildTripTickPlan(
    locations,
    tickStartedAt,
    activeTrips,
    shouldRunPredictionFallback
  );

  const transitions = buildTripTransitions(
    tripTickPlan.locations,
    existingTripsDict,
    deps.detectTripEvents
  );

  const completedTrips = transitions.filter(isCompletedTripTransition);
  const currentTrips = transitions.filter(
    (transition) => !transition.events.isCompletedTrip
  );

  const [completedLifecycle, currentLifecycle] = buildLifecycleCommands(
    completedTrips.length,
    currentTrips.length
  );
  assertSequentialLifecycleOrder(completedLifecycle, currentLifecycle);

  const completedFacts = await processCompletedTrips(
    ctx,
    completedTrips,
    tripTickPlan.shouldRunPredictionFallback,
    logVesselProcessingError,
    {
      buildCompletedTrip: deps.buildCompletedTrip,
      buildTrip: deps.buildTrip,
    }
  );
  const currentBranch = await processCurrentTrips(
    ctx,
    currentTrips,
    tripTickPlan.shouldRunPredictionFallback,
    deps.buildTrip
  );
  const projectionBatch = mergeProjectionBatches(
    buildProjectionBatchFromCompletedFacts(completedFacts),
    buildProjectionBatchFromCurrentIntents(
      currentBranch.successfulVessels,
      currentBranch.pendingActualIntents,
      currentBranch.pendingPredictedIntents
    )
  );

  // Project only after trip writes succeed so downstream views stay in sync.
  await Promise.all([
    projectionBatch.actualPatches.length > 0
      ? ctx.runMutation(
          internal.functions.eventsActual.mutations
            .projectActualBoundaryPatches,
          {
            Patches: projectionBatch.actualPatches,
          }
        )
      : Promise.resolve(),
    projectionBatch.predictedEffects.length > 0
      ? ctx.runMutation(
          internal.functions.eventsPredicted.mutations
            .projectPredictedBoundaryEffects,
          {
            Effects: projectionBatch.predictedEffects,
          }
        )
      : Promise.resolve(),
  ]);
};

/**
 * Build one transition object per vessel update so event detection happens once.
 *
 * @param locations - Current vessel locations for this tick
 * @param existingTripsDict - Active trips indexed by vessel abbreviation
 * @param detectTripEventsFn - Event detector to run for each vessel transition
 * @returns Array of vessel transitions with precomputed events
 */
const buildTripTransitions = (
  locations: ConvexVesselLocation[],
  existingTripsDict: Record<string, ConvexVesselTrip>,
  detectTripEventsFn: typeof detectTripEvents
): TripTransition[] =>
  locations.map((currLocation) => {
    const existingTrip = existingTripsDict[currLocation.VesselAbbrev];
    return {
      currLocation,
      existingTrip,
      events: detectTripEventsFn(existingTrip, currLocation),
    };
  });

/**
 * Type guard for trip-boundary transitions.
 *
 * @param transition - Per-vessel transition state
 * @returns True when the transition completes an existing trip
 */
const isCompletedTripTransition = (
  transition: TripTransition
): transition is CompletedTripTransition =>
  transition.events.isCompletedTrip && transition.existingTrip !== undefined;

/**
 * Log a vessel-specific processing failure without aborting the batch.
 *
 * @param vesselAbbrev - Vessel identifier being processed
 * @param phase - Human-readable processing phase name
 * @param error - Error thrown while processing this vessel
 */
const logVesselProcessingError = (
  vesselAbbrev: string,
  phase: string,
  error: unknown
): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    `[VesselTrips] Failed ${phase} for ${vesselAbbrev}: ${err.message}`,
    err
  );
};
