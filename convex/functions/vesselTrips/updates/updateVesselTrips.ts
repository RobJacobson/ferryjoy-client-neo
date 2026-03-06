import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { handlePredictionEvent } from "domain/ml/prediction";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildCompletedTrip } from "./buildCompletedTrip";
import { buildTrip } from "./buildTrip";
import type { TripEvents } from "./eventDetection";
import { detectTripEvents } from "./eventDetection";
import { tripsAreEqual } from "./utils";

// Throttles time-based prediction fallback to first 5 seconds of each minute
const PREDICTION_FALLBACK_WINDOW_SECONDS = 5;

// ============================================================================
// Transition Types
// Each transition carries one vessel's previous state, current location,
// and precomputed events through the orchestration pipeline.
// ============================================================================

type TripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ConvexVesselTrip;
  events: TripEvents;
};

type CompletedTripTransition = TripTransition & {
  existingTrip: ConvexVesselTrip;
};

type PendingLeaveDockEffect = {
  vesselAbbrev: string;
  trip: ConvexVesselTrip;
};

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Main orchestration for updating active vessel trips.
 *
 * Builds a per-vessel transition object once, categorizes transitions by trip
 * boundary, then delegates to processing functions that handle persistence.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process after orchestrator conversion
 */
export const runUpdateVesselTrips = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[]
): Promise<void> => {
  // Load active trips once for O(1) per-vessel lookup
  const existingTripsList = await ctx.runQuery(
    api.functions.vesselTrips.queries.getActiveTrips
  );

  // Index active trips by vessel abbreviation for fast lookup
  const existingTripsDict = Object.fromEntries(
    (existingTripsList ?? []).map((trip) => [trip.VesselAbbrev, trip] as const)
  ) as Record<string, ConvexVesselTrip>;

  // Build transition objects with precomputed events for each vessel
  const transitions = buildTripTransitions(locations, existingTripsDict);

  // Check if we're in the fallback window for time-based predictions
  const shouldRunPredictionFallback =
    new Date().getSeconds() < PREDICTION_FALLBACK_WINDOW_SECONDS;

  // Categorize transitions: trip boundaries vs ongoing trips
  const completedTrips = transitions.filter(isCompletedTripTransition);
  const currentTrips = transitions.filter(
    (transition) => !transition.events.isCompletedTrip
  );

  // Process each category with appropriate handlers
  await processCompletedTrips(ctx, completedTrips, shouldRunPredictionFallback);
  await processCurrentTrips(ctx, currentTrips, shouldRunPredictionFallback);
};

// ============================================================================
// Processing Functions
// ============================================================================

/**
 * Process trip boundaries: complete current trip and start new one.
 *
 * Takes array of vessels at trip boundaries, completes each and starts new trip.
 *
 * @param ctx - Convex action context
 * @param completedTrips - Array of vessel transitions at trip boundaries
 */
const processCompletedTrips = async (
  ctx: ActionCtx,
  completedTrips: CompletedTripTransition[],
  shouldRunPredictionFallback: boolean
): Promise<void> => {
  for (const { existingTrip, currLocation, events } of completedTrips) {
    try {
      // Build completed trip from the existing active trip.
      const tripToComplete = buildCompletedTrip(existingTrip, currLocation);

      // Build the replacement active trip using the same transition context.
      const newTrip = await buildTrip(
        ctx,
        currLocation,
        existingTrip,
        true,
        events,
        shouldRunPredictionFallback
      );

      // Persist atomically (complete + start)
      await ctx.runMutation(
        api.functions.vesselTrips.mutations.completeAndStartNewTrip,
        {
          completedTrip: tripToComplete,
          newTrip,
        }
      );

      // Delegate prediction lifecycle to service
      await handlePredictionEvent(ctx, {
        eventType: "trip_complete",
        trip: tripToComplete,
      });
    } catch (error) {
      logVesselProcessingError(
        currLocation.VesselAbbrev,
        "completed-trip processing",
        error
      );
    }
  }
};

/**
 * Process current trips (not a completed trip).
 *
 * Takes array of vessels continuing same trip, builds and persists in batch.
 *
 * @param ctx - Convex action context
 * @param currentTrips - Array of vessel transitions with ongoing trips
 */
const processCurrentTrips = async (
  ctx: ActionCtx,
  currentTrips: TripTransition[],
  shouldRunPredictionFallback: boolean
): Promise<void> => {
  const activeUpserts: ConvexVesselTrip[] = [];

  // Queue leave-dock side effects to run only after successful upsert
  const pendingLeaveDockEffects: PendingLeaveDockEffect[] = [];

  // Process each current trip
  for (const { existingTrip, currLocation, events } of currentTrips) {
    try {
      // Build trip with all enrichments (schedule, predictions, actuals)
      const tripWithPredictions = await buildTrip(
        ctx,
        currLocation,
        existingTrip,
        false,
        events,
        shouldRunPredictionFallback
      );

      // Override TimeStamp from current location (it changes every tick)
      const finalProposed: ConvexVesselTrip = {
        ...tripWithPredictions,
        TimeStamp: currLocation.TimeStamp,
      };

      // Only write if trip changed (or is new)
      if (!existingTrip || !tripsAreEqual(existingTrip, finalProposed)) {
        activeUpserts.push(finalProposed);

        // Queue leave-dock side effects for post-persist execution
        if (events.didJustLeaveDock && finalProposed.LeftDock !== undefined) {
          pendingLeaveDockEffects.push({
            vesselAbbrev: currLocation.VesselAbbrev,
            trip: finalProposed,
          });
        }
      }
    } catch (error) {
      logVesselProcessingError(
        currLocation.VesselAbbrev,
        "current-trip processing",
        error
      );
    }
  }

  // Batch upsert all changed trips in a single database write
  if (activeUpserts.length > 0) {
    const upsertResult = await ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
      { activeUpserts }
    );

    // Track successful vessels to run side effects only for them
    const successfulVessels = new Set<string>();

    // Process per-vessel results from batch upsert
    for (const result of upsertResult.perVessel) {
      if (result.ok) {
        successfulVessels.add(result.vesselAbbrev);
        continue;
      }

      console.error(
        `[VesselTrips] Failed active-trip upsert for ${result.vesselAbbrev}: ${
          result.reason ?? "unknown error"
        }`
      );
    }

    // Execute leave-dock side effects only for vessels that successfully upserted
    for (const effect of pendingLeaveDockEffects) {
      // Skip if upsert failed for this vessel
      if (!successfulVessels.has(effect.vesselAbbrev)) {
        continue;
      }

      try {
        // Fetch previous completed trip for backfill
        const previousTripResult = await ctx.runQuery(
          api.functions.vesselTrips.queries.getMostRecentCompletedTrip,
          { vesselAbbrev: effect.vesselAbbrev }
        );
        const previousTrip = previousTripResult ?? undefined;

        // Insert completed prediction records and backfill depart-next actuals
        await handlePredictionEvent(ctx, {
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
    }
  }
};

/**
 * Build one transition object per vessel update so event detection happens once.
 *
 * @param locations - Current vessel locations for this tick
 * @param existingTripsDict - Active trips indexed by vessel abbreviation
 * @returns Array of vessel transitions with precomputed events
 */
const buildTripTransitions = (
  locations: ConvexVesselLocation[],
  existingTripsDict: Record<string, ConvexVesselTrip>
): TripTransition[] =>
  locations.map((currLocation) => {
    const existingTrip = existingTripsDict[currLocation.VesselAbbrev];
    return {
      currLocation,
      existingTrip,
      events: detectTripEvents(existingTrip, currLocation),
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
