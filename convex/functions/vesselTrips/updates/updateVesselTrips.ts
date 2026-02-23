import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { buildTripWithPredictions } from "domain/ml/prediction";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import { extractPredictionRecord } from "functions/predictions/utils";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { buildCompletedTrip, buildTripFromVesselLocation } from "./buildTrip";
import {
  buildTripWithSchedule,
  lookupScheduleAtArrival,
} from "./lookupScheduledTrip";
import { tripsAreEqual, updateAndExtractPredictions } from "./utils";

// ============================================================================
// Group Types
// ============================================================================

interface NewTripGroup {
  vesselAbbrev: string;
  currLocation: ConvexVesselLocation;
}

interface CompletedTripGroup {
  vesselAbbrev: string;
  currLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip;
}

interface CurrentTripGroup {
  vesselAbbrev: string;
  currLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip;
}

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
  const existingTripsList = (
    await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips)
  ).map(
    (doc) => stripConvexMeta(doc as Record<string, unknown>) as ConvexVesselTrip
  );

  // 2) Index active trips by vessel abbreviation.
  const existingTripsDict = Object.fromEntries(
    existingTripsList.map((trip) => [trip.VesselAbbrev, trip] as const)
  ) as Record<string, ConvexVesselTrip>;

  // 3) Categorize vessel/location tuples into three groups.
  const newTrips: NewTripGroup[] = [];
  const completedTrips: CompletedTripGroup[] = [];
  const currentTrips: CurrentTripGroup[] = [];

  for (const currLocation of locations) {
    const vesselAbbrev = currLocation.VesselAbbrev;
    const existingTrip = existingTripsDict[vesselAbbrev];

    if (!existingTrip) {
      newTrips.push({ vesselAbbrev, currLocation });
      continue;
    }

    const isTripBoundary =
      existingTrip.DepartingTerminalAbbrev !==
      currLocation.DepartingTerminalAbbrev;

    if (isTripBoundary) {
      completedTrips.push({ vesselAbbrev, currLocation, existingTrip });
    } else {
      currentTrips.push({ vesselAbbrev, currLocation, existingTrip });
    }
  }

  // 4) Delegate to processing functions (each handles its own persistence).
  await processNewTrips(ctx, newTrips);
  await processCompletedTrips(ctx, completedTrips);
  await processCurrentTrips(ctx, currentTrips);
};

// ============================================================================
// Processing Functions
// ============================================================================

/**
 * Process vessels with no existing trip (first appearance).
 *
 * Takes array of new vessels, builds and persists each directly to database.
 *
 * @param ctx - Convex action context
 * @param newTrips - Array of vessels without existing trips
 */
const processNewTrips = async (
  ctx: ActionCtx,
  newTrips: NewTripGroup[]
): Promise<void> => {
  for (const { currLocation } of newTrips) {
    const newTrip = buildTripFromVesselLocation(currLocation);
    const tripWithSchedule = await buildTripWithSchedule(
      ctx,
      newTrip,
      undefined
    );
    const tripWithPredictions = await buildTripWithPredictions(
      ctx,
      tripWithSchedule,
      undefined
    );

    // Persist directly to database
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertActiveTrip,
      { trip: tripWithPredictions }
    );
  }
};

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
    // Build completed trip
    const completedTrip = buildCompletedTrip(existingTrip, currLocation);

    // Build new trip
    const newTripBase = buildTripFromVesselLocation(
      currLocation,
      undefined,
      completedTrip
    );
    const arrivalTrip = await lookupScheduleAtArrival(
      ctx,
      newTripBase,
      undefined
    );
    const tripWithScheduled = await buildTripWithSchedule(
      ctx,
      arrivalTrip,
      undefined
    );
    const newTrip = await buildTripWithPredictions(
      ctx,
      tripWithScheduled,
      undefined
    );

    // Extract prediction records from completed trip
    const { completedRecords } = updateAndExtractPredictions(
      stripConvexMeta(existingTrip) as ConvexVesselTrip,
      completedTrip
    );

    // Persist atomically (complete + start)
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.completeAndStartNewTrip,
      {
        completedTrip,
        newTrip,
      }
    );

    // Insert prediction records
    if (completedRecords.length > 0) {
      await ctx.runMutation(
        api.functions.predictions.mutations.bulkInsertPredictions,
        { predictions: completedRecords }
      );
    }
  }
};

/**
 * Process ongoing trips (not a boundary).
 *
 * Takes array of vessels continuing same trip, builds and persists in batch.
 *
 * @param ctx - Convex action context
 * @param currentTrips - Array of vessels with ongoing trips
 */
const processCurrentTrips = async (
  ctx: ActionCtx,
  currentTrips: CurrentTripGroup[]
): Promise<void> => {
  const activeUpserts: ConvexVesselTrip[] = [];
  const predictionRecords: ConvexPredictionRecord[] = [];
  const backfillNeeded: Array<{
    vesselAbbrev: string;
    leftDockMs: number;
  }> = [];

  for (const { existingTrip, currLocation } of currentTrips) {
    const baseTrip = buildTripFromVesselLocation(currLocation, existingTrip);
    const tripWithSchedule = await buildTripWithSchedule(
      ctx,
      baseTrip,
      existingTrip
    );
    const tripWithPredictions = await buildTripWithPredictions(
      ctx,
      tripWithSchedule,
      existingTrip
    );

    const didJustLeaveDock =
      existingTrip.LeftDock === undefined &&
      tripWithPredictions.LeftDock !== undefined;

    const { updatedTrip, completedRecords } = didJustLeaveDock
      ? updateAndExtractPredictions(existingTrip, tripWithPredictions)
      : { updatedTrip: tripWithPredictions, completedRecords: [] };

    predictionRecords.push(...completedRecords);

    const finalProposed: ConvexVesselTrip = {
      ...updatedTrip,
      TimeStamp: currLocation.TimeStamp,
    };

    if (!tripsAreEqual(existingTrip, finalProposed)) {
      activeUpserts.push(finalProposed);

      if (didJustLeaveDock && finalProposed.LeftDock !== undefined) {
        backfillNeeded.push({
          vesselAbbrev: currLocation.VesselAbbrev,
          leftDockMs: finalProposed.LeftDock,
        });
      }
    }
  }

  // Batch upsert all current trips
  if (activeUpserts.length > 0) {
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
      { activeUpserts }
    );
  }

  // Insert prediction records
  if (predictionRecords.length > 0) {
    await ctx.runMutation(
      api.functions.predictions.mutations.bulkInsertPredictions,
      { predictions: predictionRecords }
    );
  }

  // Handle depart-next backfills
  for (const { vesselAbbrev, leftDockMs } of backfillNeeded) {
    const backfillResult = await ctx.runMutation(
      api.functions.vesselTrips.mutations
        .setDepartNextActualsForMostRecentCompletedTrip,
      {
        vesselAbbrev,
        actualDepartMs: leftDockMs,
      }
    );

    if (
      backfillResult?.updated === true &&
      backfillResult?.updatedTrip !== undefined
    ) {
      const tripData = stripConvexMeta(
        backfillResult.updatedTrip as Record<string, unknown>
      ) as ConvexVesselTrip;
      const departNextRecords = [
        extractPredictionRecord(tripData, "AtDockDepartNext"),
        extractPredictionRecord(tripData, "AtSeaDepartNext"),
      ].filter((r): r is ConvexPredictionRecord => r !== null);
      if (departNextRecords.length > 0) {
        await ctx.runMutation(
          api.functions.predictions.mutations.bulkInsertPredictions,
          { predictions: departNextRecords }
        );
      }
    }
  }
};
