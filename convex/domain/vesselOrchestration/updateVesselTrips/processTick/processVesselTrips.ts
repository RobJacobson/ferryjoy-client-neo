/**
 * Vessel-trip **plan** computation (**updateVesselTrips** tick branch).
 *
 * Builds a {@link VesselTripTickWritePlan} for the functions-layer applier;
 * persistence and {@link buildTimelineTickProjectionInput} run outside this module
 * (see `updateVesselOrchestrator` in `functions/vesselOrchestrator`). ML
 * attachment for trips is **updateVesselPredictions** (`applyVesselPredictions`,
 * invoked from `buildTrip` after schedule enrichment; see `architecture.md` §10).
 */

import type { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";
import {
  type ProcessCompletedTripsDeps,
  processCompletedTrips,
} from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips";
import { processCurrentTrips } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { VesselTripTickWritePlan } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripTickWritePlan";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTripWithPredictions,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";
import { computeShouldRunPredictionFallback } from "./tickPredictionPolicy";

/** Optional tick inputs; prediction fallback may be supplied by orchestrator. */
export type ProcessVesselTripsOptions = {
  shouldRunPredictionFallback?: boolean;
};

/** Existing active trip row for one vessel: stored columns and/or enriched prediction fields. */
type ExistingTripForTick = ConvexVesselTripWithPredictions | TickActiveTrip;

type TripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ExistingTripForTick;
  events: TripEvents;
};

type CompletedTripTransition = TripTransition & {
  existingTrip: ExistingTripForTick;
};

export type ProcessVesselTripsDeps = ProcessCompletedTripsDeps & {
  detectTripEvents: typeof detectTripEvents;
};

/**
 * Computes the domain write plan for one vessel-orchestrator tick (completed
 * handoffs then current-trip fragment). Does not run Convex mutations or timeline
 * assembly; the functions runner applies the plan then calls
 * `buildTimelineTickProjectionInput`.
 *
 * @param locations - Array of vessel locations to process after orchestrator conversion
 * @param tickStartedAt - Tick timestamp owned by VesselOrchestrator (unused in plan
 *   body; kept for signature parity with the orchestrator dep)
 * @param deps - Internal dependency bag used for testability (includes
 *   `buildTripAdapters`, `predictionModelAccess`, `detectTripEvents`)
 * @param activeTrips - Preloaded active trips for this tick. Prefer
 *   {@link TickActiveTrip} rows; trips enriched with predictions remain
 *   accepted for tests.
 * @param options - Optional tick policy; fallback window defaults from `tickStartedAt`
 * @returns Write plan for `applyVesselTripTickWritePlan`
 */
export const computeVesselTripTickWritePlan = async (
  locations: ReadonlyArray<ConvexVesselLocation>,
  tickStartedAt: number,
  deps: ProcessVesselTripsDeps,
  activeTrips: ReadonlyArray<TickActiveTrip | ConvexVesselTripWithPredictions>,
  options?: ProcessVesselTripsOptions
): Promise<{ plan: VesselTripTickWritePlan }> => {
  // Preloaded snapshot rows (storage-native and/or prediction-enriched) keyed for
  // event detection and `buildTrip`; stripping ML for DB writes happens in the applier.
  const existingTripsDict = Object.fromEntries(
    activeTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  ) as Record<string, ExistingTripForTick>;

  const shouldRunPredictionFallback =
    options?.shouldRunPredictionFallback ??
    computeShouldRunPredictionFallback(tickStartedAt);

  const transitions = buildTripTransitions(
    locations,
    existingTripsDict,
    deps.detectTripEvents
  );

  const completedTrips = transitions.filter(isCompletedTripTransition);
  const currentTrips = transitions.filter(
    (transition) => !transition.events.isCompletedTrip
  );

  // Build plan: completed handoffs before current-trip artifacts (apply order).
  const completedHandoffs = await processCompletedTrips(
    completedTrips,
    shouldRunPredictionFallback,
    logVesselProcessingError,
    {
      buildCompletedTrip: deps.buildCompletedTrip,
      buildTrip: deps.buildTrip,
      buildTripAdapters: deps.buildTripAdapters,
      predictionModelAccess: deps.predictionModelAccess,
    }
  );
  const currentFragment = await processCurrentTrips(
    currentTrips,
    shouldRunPredictionFallback,
    {
      buildTrip: deps.buildTrip,
      buildTripAdapters: deps.buildTripAdapters,
      predictionModelAccess: deps.predictionModelAccess,
    }
  );

  return {
    plan: {
      completedHandoffs,
      current: currentFragment,
    },
  };
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
  locations: ReadonlyArray<ConvexVesselLocation>,
  existingTripsDict: Record<string, ExistingTripForTick>,
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
