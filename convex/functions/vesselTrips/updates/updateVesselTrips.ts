import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import {
  computeVesselTripPredictionsPatch,
  updatePredictionsWithActuals,
} from "domain/ml/prediction";
import { extractPredictionRecord } from "functions/predictions/utils";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  type ConvexVesselTrip,
  toConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { enrichTripFields } from "./locationEnrichment";
import { enrichTripStartUpdates } from "./scheduledTripEnrichment";

/**
 * Main orchestration function for updating active vessel trips.
 *
 * Processes vessel locations and active trips to handle trip lifecycle events
 * (first trips, new trips, trip updates). Manages trip enrichment, prediction
 * generation, and database persistence.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process (already converted and deduplicated)
 */
export const runUpdateVesselTrips = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[]
): Promise<void> => {
  // Fetch current active trips and index them by vessel for O(1) lookup.
  const existingTripsList = (
    await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips)
  ).map((doc) => stripConvexMeta(doc) as ConvexVesselTrip);

  const existingTripsDict = Object.fromEntries(
    existingTripsList.map((trip) => [trip.VesselAbbrev, trip])
  ) as Record<string, ConvexVesselTrip>;

  // Process each vessel independently.
  for (const currLocation of locations) {
    const existingTrip = existingTripsDict[currLocation.VesselAbbrev];

    // Case: first sighting for this vessel.
    if (isFirstTrip(existingTrip)) {
      await handleFirstTrip(ctx, currLocation);
      continue;
    }

    // Case: departing terminal changed → treat as a new trip boundary.
    if (isNewTrip(existingTrip, currLocation)) {
      await handleNewTrip(ctx, existingTrip, currLocation);
      continue;
    }

    // Case: same trip → update any changed fields and enrich.
    await handleTripUpdate(ctx, currLocation, existingTrip);
  }
};

/**
 * Create the first active trip for a vessel we haven't seen before.
 * @param ctx - Convex action context for database operations
 * @param currLocation - Current vessel location data
 */
const handleFirstTrip = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation
): Promise<void> => {
  const newTrip = toConvexVesselTrip(currLocation, {});

  // Upsert keeps the "one active trip per vessel" invariant.
  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: newTrip,
  });
};

/**
 * Complete the existing trip and start a new active trip.
 *
 * @param ctx - Convex action context for database operations
 * @param existingTrip - Current active trip to complete
 * @param currLocation - Current vessel location data for new trip
 */
const handleNewTrip = async (
  ctx: ActionCtx,
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): Promise<void> => {
  // Defensive: strip any Convex metadata if it slipped into the object.
  const existingTripClean = stripConvexMeta(existingTrip) as ConvexVesselTrip;

  // Base completed trip is the final active snapshot + TripEnd.
  const completedTripBase = {
    ...existingTripClean,
    TripEnd: currLocation.TimeStamp,
  };

  // Calculate durations when trip ends (in minutes, rounded to nearest tenth).
  // AtSeaDuration: time delta TripEnd - LeftDock
  const atSeaDuration = calculateTimeDelta(
    completedTripBase.LeftDock,
    completedTripBase.TripEnd
  );
  if (atSeaDuration !== undefined) {
    completedTripBase.AtSeaDuration = atSeaDuration;
  }

  // TotalDuration: time delta TripEnd - TripStart
  const totalDuration = calculateTimeDelta(
    completedTripBase.TripStart,
    completedTripBase.TripEnd
  );
  if (totalDuration !== undefined) {
    completedTripBase.TotalDuration = totalDuration;
  }

  // Overlay "actuals" onto predictions (immutably), based on final state.
  const completedTrip = {
    ...completedTripBase,
    ...updatePredictionsWithActuals(existingTripClean, completedTripBase),
  };

  // Insert completed predictions into predictions table
  await insertCompletedPredictions(ctx, completedTrip);

  // Start a fresh active trip, denormalizing previous-trip info for ML features.
  const newTrip = toConvexVesselTrip(currLocation, {
    TripStart: currLocation.TimeStamp,
    // PrevTerminalAbbrev represents the *previous trip's departing terminal*
    // (A in A->B then B->C). This is used by ML features as the origin of the
    // previous leg (A->B), not the previous leg's arrival (B).
    PrevTerminalAbbrev: completedTrip.DepartingTerminalAbbrev,
    PrevScheduledDeparture: completedTrip.ScheduledDeparture,
    PrevLeftDock: completedTrip.LeftDock,
  });

  // Store the completed trip and overwrite the active trip atomically.
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.completeAndStartNewTrip,
    {
      completedTrip,
      newTrip,
    }
  );
};

/**
 * Apply incremental updates to an existing active trip.
 * @param ctx - Convex action context for database operations
 * @param currLocation - Current vessel location data
 * @param existingTrip - Existing active trip to update
 */
const handleTripUpdate = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
): Promise<void> => {
  // 1) Apply raw/derived fields from WSF location feed.
  const tripFieldUpdates = enrichTripFields(existingTrip, currLocation);
  const baseTrip: ConvexVesselTrip = {
    ...existingTrip,
    ...tripFieldUpdates,
  };

  // 2) Keep `Key` in sync and (optionally) copy ScheduledTrip snapshot.
  const tripStartUpdates = await enrichTripStartUpdates(ctx, baseTrip);

  // 3) Add predictions when the required preconditions are satisfied.
  const tripForPredictions: ConvexVesselTrip = {
    ...baseTrip,
    ...tripStartUpdates,
  };
  const predictionUpdates = await computeVesselTripPredictionsPatch(
    ctx,
    tripForPredictions
  );

  const updatedData: Partial<ConvexVesselTrip> = {
    ...tripFieldUpdates,
    ...tripStartUpdates,
    ...predictionUpdates,
  };

  // Nothing changed → avoid a write (and downstream subscription churn).
  if (Object.keys(updatedData).length === 0) {
    return;
  }

  console.log(currLocation.VesselAbbrev, Object.keys(updatedData), "updates:", {
    ...updatedData,
  });

  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: {
      ...existingTrip,
      ...updatedData,
      TimeStamp: currLocation.TimeStamp,
    },
  });

  // When this trip leaves dock:
  // 1. Backfill depart-next actuals onto the previous completed trip (A->B)
  // 2. Update AtDockDepartCurr actuals on the current active trip
  const didJustLeaveDock = !existingTrip.LeftDock && baseTrip.LeftDock;
  if (didJustLeaveDock) {
    // Update depart-next predictions on the previous completed trip
    const departNextResult = await ctx.runMutation(
      api.functions.vesselTrips.mutations
        .setDepartNextActualsForMostRecentCompletedTrip,
      {
        vesselAbbrev: existingTrip.VesselAbbrev,
        actualDepartMs: baseTrip.LeftDock as number,
      }
    );

    // Insert completed depart-next predictions if they were updated
    if (departNextResult.updated && departNextResult.updatedTrip) {
      const updatedTripClean = stripConvexMeta(
        departNextResult.updatedTrip
      ) as ConvexVesselTrip;
      await insertCompletedPredictions(ctx, updatedTripClean);
    }

    // Update AtDockDepartCurr actuals on the current active trip
    const actualUpdates = updatePredictionsWithActuals(existingTrip, baseTrip);
    if (Object.keys(actualUpdates).length > 0) {
      // Merge actual updates into the mutation data
      Object.assign(updatedData, actualUpdates);

      // Create updated trip with actuals for prediction insertion
      const tripWithActuals: ConvexVesselTrip = {
        ...existingTrip,
        ...updatedData,
        TimeStamp: currLocation.TimeStamp,
      };

      // Insert completed AtDockDepartCurr prediction
      await insertCompletedPredictions(ctx, tripWithActuals);
    }
  }
};

/**
 * Insert completed predictions into the predictions table.
 * Checks each prediction field and inserts if Actual is set.
 *
 * @param ctx - Convex action context for database operations
 * @param trip - Completed vessel trip with predictions to insert
 */
const insertCompletedPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<void> => {
  const predictionFields: Array<
    | "AtDockDepartCurr"
    | "AtDockArriveNext"
    | "AtDockDepartNext"
    | "AtSeaArriveNext"
    | "AtSeaDepartNext"
  > = [
    "AtDockDepartCurr",
    "AtDockArriveNext",
    "AtDockDepartNext",
    "AtSeaArriveNext",
    "AtSeaDepartNext",
  ];

  for (const field of predictionFields) {
    const predictionRecord = extractPredictionRecord(trip, field);
    if (predictionRecord) {
      await ctx.runMutation(
        api.functions.predictions.mutations.insertPrediction,
        {
          prediction: predictionRecord,
        }
      );
    }
  }
};

/**
 * Checks if this is the first trip for a vessel (no existing trip).
 * @param existingTrip - Existing vessel trip or undefined if none exists
 * @returns True if this is the first trip for the vessel
 */
const isFirstTrip = (existingTrip: ConvexVesselTrip | undefined): boolean =>
  !existingTrip;

/**
 * Checks if a new trip is needed based on departing terminal change.
 * @param existingTrip - The current active trip for the vessel
 * @param currLocation - The current vessel location data
 * @returns True if vessel has moved to a different departing terminal
 */
const isNewTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): boolean =>
  existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev;
