// ============================================================================
// PREDICTION SERVICE
// Manages prediction lifecycle end-to-end: creation, actualization, and record insertion
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import {
  extractPredictionRecord,
  PREDICTION_FIELDS,
} from "functions/predictions/utils";
import type { ConvexVesselTrip } from "../../../functions/vesselTrips/schemas";

/**
 * Types of prediction lifecycle events that can occur during vessel trips.
 */
export type PredictionEventType = "leave_dock" | "trip_complete";

/**
 * Event object describing a prediction lifecycle event.
 */
export interface PredictionLifecycleEvent {
  eventType: PredictionEventType;
  trip: ConvexVesselTrip;
  previousTrip?: ConvexVesselTrip;
}

/**
 * Handle prediction lifecycle events end-to-end.
 *
 * This is the main entry point for prediction management. It delegates to
 * specific handlers based on event type, ensuring all prediction-related
 * side effects (record insertion and prior-trip backfill) are handled in the
 * ML domain, not in trip orchestration code.
 *
 * @param ctx - Convex action context
 * @param event - Prediction lifecycle event to handle
 */
export const handlePredictionEvent = async (
  ctx: ActionCtx,
  event: PredictionLifecycleEvent
): Promise<void> => {
  switch (event.eventType) {
    case "leave_dock":
      return handleLeaveDockEvent(ctx, event.trip, event.previousTrip);
    case "trip_complete":
      return handleTripCompleteEvent(ctx, event.trip);
    default:
      return;
  }
};

/**
 * Handle leave-dock event for a trip already finalized before persistence.
 *
 * 1. Inserts completed prediction records from the current trip
 * 2. Backfills AtDockDepartNext and AtSeaDepartNext on previous trip
 * 3. Inserts prediction records for backfilled previous trip
 *
 * @param ctx - Convex action context
 * @param trip - Current vessel trip (just left dock)
 * @param previousTrip - Previous completed trip (for backfill)
 */
const handleLeaveDockEvent = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  previousTrip?: ConvexVesselTrip
): Promise<void> => {
  const leftDockMs = trip.LeftDock;
  if (!leftDockMs) {
    return;
  }

  // 1. Insert records from the already-finalized current trip.
  await insertCompletedPredictions(ctx, trip);

  // 2. Backfill previous trip's depart-next predictions.
  if (previousTrip) {
    await backfillDepartNextPredictions(ctx, previousTrip, leftDockMs);
  }
};

/**
 * Handle trip-complete event for a trip already finalized before persistence.
 *
 * Inserts all completed prediction records for the trip.
 *
 * @param ctx - Convex action context
 * @param trip - Completed vessel trip
 */
const handleTripCompleteEvent = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<void> => {
  await insertCompletedPredictions(ctx, trip);
};

/**
 * Extract completed prediction records from a trip.
 *
 * Filters out predictions that don't have Actual values set.
 *
 * @param trip - Vessel trip with predictions
 * @returns Array of completed prediction records
 */
const extractCompletedPredictionRecords = (
  trip: ConvexVesselTrip
): ConvexPredictionRecord[] => {
  return PREDICTION_FIELDS.map((field) =>
    extractPredictionRecord(trip, field)
  ).filter(
    (r): r is ConvexPredictionRecord => r !== null && r.Actual !== undefined
  );
};

/**
 * Insert completed prediction records into the predictions table.
 *
 * @param ctx - Convex action context
 * @param trip - Trip containing completed predictions
 */
const insertCompletedPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<void> => {
  const records = extractCompletedPredictionRecords(trip);
  if (records.length > 0) {
    await ctx.runMutation(
      api.functions.predictions.mutations.bulkInsertPredictions,
      { predictions: records }
    );
  }
};

/**
 * Backfill depart-next predictions onto a completed trip.
 *
 * When current trip leaves dock at terminal B (B->C LeftDock becomes known),
 * that timestamp is the "actual depart-next" event for the previous completed
 * trip (A->B) at terminal B.
 *
 * @param ctx - Convex action context
 * @param completedTrip - Previous completed trip to backfill
 * @param actualDepartMs - Actual departure timestamp from the current trip
 */
const backfillDepartNextPredictions = async (
  ctx: ActionCtx,
  completedTrip: ConvexVesselTrip,
  actualDepartMs: number
): Promise<void> => {
  const backfillResult = await ctx.runMutation(
    api.functions.vesselTrips.mutations
      .setDepartNextActualsForMostRecentCompletedTrip,
    {
      vesselAbbrev: completedTrip.VesselAbbrev,
      actualDepartMs,
    }
  );

  if (!backfillResult?.updated || !backfillResult.updatedTrip) {
    return;
  }

  const updatedTrip = backfillResult.updatedTrip;
  await insertCompletedPredictions(ctx, updatedTrip);
};
