/**
 * Vessel-trip processing entrypoint.
 *
 * Runs lifecycle state transitions and persistence, then returns tick event
 * writes for the orchestrator to apply (`applyTickEventWrites`).
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";
import {
  buildTickEventWritesFromCompletedFacts,
  buildTickEventWritesFromCurrentMessages,
} from "../projection/timelineEventAssembler";
import type { detectTripEvents } from "../tripLifecycle/detectTripEvents";
import {
  type ProcessCompletedTripsDeps,
  processCompletedTrips,
} from "../tripLifecycle/processCompletedTrips";
import { processCurrentTrips } from "../tripLifecycle/processCurrentTrips";
import type { TripEvents } from "../tripLifecycle/tripEventTypes";
import type { VesselTripsTickResult } from "./tickEnvelope";
import { mergeTickEventWrites } from "./tickEventWrites";
import { computeShouldRunPredictionFallback } from "./tickPredictionPolicy";

/** Optional tick inputs; prediction fallback may be supplied by orchestrator. */
export type ProcessVesselTripsOptions = {
  shouldRunPredictionFallback?: boolean;
};

/** Existing active trip row for one vessel: persisted columns and/or hydrated ML fields. */
type ExistingTripForTick = ConvexVesselTrip | TickActiveTrip;

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
 * Process vessel trips with injectable dependencies.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process after orchestrator conversion
 * @param tickStartedAt - Tick timestamp owned by VesselOrchestrator
 * @param deps - Internal dependency bag used for testability (includes `buildTripAdapters`)
 * @param activeTrips - When **defined** (including `[]`), used instead of
 *   `getActiveTrips` (see `processVesselTrips` from the functions shim). Prefer {@link TickActiveTrip}
 *   rows; hydrated trips optional.
 * @param options - Optional tick policy; fallback window defaults from `tickStartedAt`
 * @returns Lifecycle result plus tick event writes for orchestrator peers
 */
export const processVesselTripsWithDeps = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[],
  tickStartedAt: number,
  deps: ProcessVesselTripsDeps,
  activeTrips?: ReadonlyArray<TickActiveTrip>,
  options?: ProcessVesselTripsOptions
): Promise<VesselTripsTickResult> => {
  const existingTripsList =
    activeTrips ??
    (await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips));

  // Values are storage-native and/or query-hydrated rows; lifecycle strips ML for persist checks.
  const existingTripsDict = Object.fromEntries(
    (existingTripsList ?? []).map((trip) => [trip.VesselAbbrev, trip] as const)
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

  // Completed-trip boundaries must run before current-trip updates.
  const completedFacts = await processCompletedTrips(
    ctx,
    completedTrips,
    shouldRunPredictionFallback,
    logVesselProcessingError,
    {
      buildCompletedTrip: deps.buildCompletedTrip,
      buildTrip: deps.buildTrip,
      buildTripAdapters: deps.buildTripAdapters,
    }
  );
  const currentBranch = await processCurrentTrips(
    ctx,
    currentTrips,
    shouldRunPredictionFallback,
    {
      buildTrip: deps.buildTrip,
      buildTripAdapters: deps.buildTripAdapters,
    }
  );
  const tickEventWrites = mergeTickEventWrites(
    buildTickEventWritesFromCompletedFacts(completedFacts),
    buildTickEventWritesFromCurrentMessages(
      currentBranch.successfulVessels,
      currentBranch.pendingActualMessages,
      currentBranch.pendingPredictedMessages
    )
  );

  return {
    tickStartedAt,
    activeTripsSource: activeTrips !== undefined ? "preloaded" : "query",
    tickEventWrites,
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
  locations: ConvexVesselLocation[],
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
