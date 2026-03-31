/**
 * Vessel-trip processing entrypoint.
 *
 * Coordinates trip-boundary detection, active-trip persistence, prediction
 * lifecycle events, and downstream projection writes for each vessel tick.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { handlePredictionEvent } from "domain/ml/prediction";
import type { ResolvedVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildCompletedTrip } from "../buildCompletedTrip";
import { buildTrip } from "../buildTrip";
import type { TripEvents } from "../eventDetection";
import { detectTripEvents } from "../eventDetection";
import {
  type ProcessCompletedTripsDeps,
  processCompletedTrips,
} from "./processCompletedTrips";
import {
  type ProcessCurrentTripsDeps,
  processCurrentTrips,
} from "./processCurrentTrips";

// Restrict time-based retries to the first few seconds of each minute.
const PREDICTION_FALLBACK_WINDOW_SECONDS = 5;

type TripTransition = {
  currLocation: ResolvedVesselLocation;
  existingTrip?: ConvexVesselTrip;
  events: TripEvents;
};

type CompletedTripTransition = TripTransition & {
  existingTrip: ConvexVesselTrip;
};

type ProcessVesselTripsDeps = ProcessCurrentTripsDeps &
  ProcessCompletedTripsDeps & {
    detectTripEvents: typeof detectTripEvents;
  };

const DEFAULT_PROCESS_VESSEL_TRIPS_DEPS: ProcessVesselTripsDeps = {
  buildCompletedTrip,
  buildTrip,
  detectTripEvents,
  handlePredictionEvent,
};

/**
 * Log inconsistent dock signals without failing the rest of the update batch.
 *
 * These warnings help us spot feed-quality issues where `AtDock` and
 * `LeftDock` disagree across adjacent ticks.
 *
 * @param existingTrip - Previously persisted trip for the vessel, if any
 * @param currLocation - Current location payload being processed
 */
const logDockSignalDisagreement = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ResolvedVesselLocation
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
 * Process vessel trips for one orchestrator tick.
 *
 * Builds a per-vessel transition object once, categorizes transitions by trip
 * boundary, then delegates to processing functions that handle persistence.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process after orchestrator conversion
 * @param tickStartedAt - Tick timestamp owned by VesselOrchestrator
 * @returns Promise that resolves once the update pass completes
 */
export const processVesselTrips = async (
  ctx: ActionCtx,
  locations: ResolvedVesselLocation[],
  tickStartedAt: number
): Promise<void> => {
  await processVesselTripsWithDeps(
    ctx,
    locations,
    tickStartedAt,
    DEFAULT_PROCESS_VESSEL_TRIPS_DEPS
  );
};

/**
 * Process vessel trips with injectable dependencies.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process after orchestrator conversion
 * @param tickStartedAt - Tick timestamp owned by VesselOrchestrator
 * @param deps - Internal dependency bag used for testability
 * @returns Promise that resolves after all trip updates and projections complete
 */
export const processVesselTripsWithDeps = async (
  ctx: ActionCtx,
  locations: ResolvedVesselLocation[],
  tickStartedAt: number,
  deps: ProcessVesselTripsDeps
): Promise<void> => {
  const existingTripsList = await ctx.runQuery(
    api.functions.vesselTrips.queries.getActiveTrips
  );

  const existingTripsDict = Object.fromEntries(
    (existingTripsList ?? []).map(
      (trip: ConvexVesselTrip) => [trip.VesselAbbrev, trip] as const
    )
  ) as Record<string, ConvexVesselTrip>;

  const transitions = buildTripTransitions(
    locations,
    existingTripsDict,
    deps.detectTripEvents
  );

  // Use the orchestrator-owned tick time so all vessels share the same window.
  const shouldRunPredictionFallback =
    new Date(tickStartedAt).getSeconds() < PREDICTION_FALLBACK_WINDOW_SECONDS;

  const completedTrips = transitions.filter(isCompletedTripTransition);
  const currentTrips = transitions.filter(
    (transition) => !transition.events.isCompletedTrip
  );

  const completedEffects = await processCompletedTrips(
    ctx,
    completedTrips,
    shouldRunPredictionFallback,
    logVesselProcessingError,
    {
      buildCompletedTrip: deps.buildCompletedTrip,
      buildTrip: deps.buildTrip,
      handlePredictionEvent: deps.handlePredictionEvent,
    }
  );
  const currentEffects = await processCurrentTrips(
    ctx,
    currentTrips,
    shouldRunPredictionFallback,
    {
      logDockSignalDisagreement,
      logVesselProcessingError,
    },
    {
      buildTrip: deps.buildTrip,
      handlePredictionEvent: deps.handlePredictionEvent,
    }
  );
  const actualEffects = [
    ...completedEffects.actualEffects,
    ...currentEffects.actualEffects,
  ];
  const predictedEffects = [
    ...completedEffects.predictedEffects,
    ...currentEffects.predictedEffects,
  ];

  // Project only after trip writes succeed so downstream views stay in sync.
  await Promise.all([
    actualEffects.length > 0
      ? ctx.runMutation(
          internal.functions.vesselTimeline.mutations
            .projectActualBoundaryEffects,
          {
            Effects: actualEffects,
          }
        )
      : Promise.resolve(),
    predictedEffects.length > 0
      ? ctx.runMutation(
          internal.functions.vesselTimeline.mutations
            .projectPredictedBoundaryEffects,
          {
            Effects: predictedEffects,
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
  locations: ResolvedVesselLocation[],
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
