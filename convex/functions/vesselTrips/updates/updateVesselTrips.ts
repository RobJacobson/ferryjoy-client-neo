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

// ============================================================================
// Group Types
// Used to categorize vessels during the orchestration phase
// ============================================================================

type TripGroup = {
  currLocation: ConvexVesselLocation;
  existingTrip?: ConvexVesselTrip;
  events: TripEvents;
};

type CompletedTripGroup = {
  currLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip;
};

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Main orchestration for updating active vessel trips.
 *
 * Fundamentally simplified: categorizes vessels into three groups (new, completed,
 * current), delegates to processing functions that handle their own database
 * persistence.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process (already converted and deduplicated)
 */
export const runUpdateVesselTrips = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[]
): Promise<void> => {
  // 1) Load current active trips once (for O(1) per-vessel lookup).
  const existingTripsList = await ctx.runQuery(
    api.functions.vesselTrips.queries.getActiveTrips
  );

  // 2) Index active trips by vessel abbreviation.
  const existingTripsDict = Object.fromEntries(
    (existingTripsList ?? []).map((trip) => [trip.VesselAbbrev, trip] as const)
  ) as Record<string, ConvexVesselTrip>;

  // 3) Categorize vessel/location tuples into three groups.
  const completedTrips: CompletedTripGroup[] = [];
  const currentTrips: TripGroup[] = [];

  for (const currLocation of locations) {
    const existingTrip = existingTripsDict[currLocation.VesselAbbrev];
    const events = detectTripEvents(existingTrip, currLocation);

    if (events.isCompletedTrip) {
      completedTrips.push({ currLocation, existingTrip });
    } else {
      currentTrips.push({
        currLocation,
        existingTrip,
        events,
      });
    }
  }

  await processCompletedTrips(ctx, completedTrips);
  await processCurrentTrips(ctx, currentTrips);
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
 * @param completedTrips - Array of vessels at trip boundaries
 */
const processCompletedTrips = async (
  ctx: ActionCtx,
  completedTrips: CompletedTripGroup[]
): Promise<void> => {
  for (const { existingTrip, currLocation } of completedTrips) {
    try {
      // Build completed trip (pure function)
      const tripToComplete = buildCompletedTrip(existingTrip, currLocation);

      // Detect events for new trip
      const newTripEvents = detectTripEvents(existingTrip, currLocation);

      // Build new trip (pure function)
      const newTrip = await buildTrip(
        ctx,
        currLocation,
        existingTrip,
        true,
        newTripEvents
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
 * @param currentTrips - Array of vessels with ongoing trips
 */
const processCurrentTrips = async (
  ctx: ActionCtx,
  currentTrips: TripGroup[]
): Promise<void> => {
  const activeUpserts: ConvexVesselTrip[] = [];

  for (const { existingTrip, currLocation, events } of currentTrips) {
    try {
      const tripWithPredictions = await buildTrip(
        ctx,
        currLocation,
        existingTrip,
        false,
        events
      );

      const finalProposed: ConvexVesselTrip = {
        ...tripWithPredictions,
        TimeStamp: currLocation.TimeStamp,
      };

      if (!existingTrip || !tripsAreEqual(existingTrip, finalProposed)) {
        activeUpserts.push(finalProposed);

        // Handle prediction events
        if (events.didJustLeaveDock && finalProposed.LeftDock !== undefined) {
          // Get previous completed trip for backfill
          const previousTripResult = await ctx.runQuery(
            api.functions.vesselTrips.queries.getMostRecentCompletedTrip,
            { vesselAbbrev: currLocation.VesselAbbrev }
          );
          const previousTrip = previousTripResult ?? undefined;

          await handlePredictionEvent(ctx, {
            eventType: "leave_dock",
            trip: finalProposed,
            previousTrip,
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

  // Batch upsert all current trips
  if (activeUpserts.length > 0) {
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
      { activeUpserts }
    );
  }
};

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
