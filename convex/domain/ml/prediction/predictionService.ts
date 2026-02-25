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
import {
  appendArriveDockPredictions,
  appendLeaveDockPredictions,
} from "../../../functions/vesselTrips/updates/appendPredictions";

/**
 * Types of prediction lifecycle events that can occur during vessel trips.
 */
export type PredictionEventType =
  | "arrive_dock"
  | "leave_dock"
  | "trip_complete";

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
 * operations (computation, actualization, record insertion) are handled
 * in the ML domain, not in trip orchestration code.
 *
 * @param ctx - Convex action context
 * @param event - Prediction lifecycle event to handle
 */
export const handlePredictionEvent = async (
  ctx: ActionCtx,
  event: PredictionLifecycleEvent
): Promise<ConvexVesselTrip | undefined> => {
  switch (event.eventType) {
    case "arrive_dock":
      return handleArriveDockEvent(ctx, event.trip);
    case "leave_dock":
      await handleLeaveDockEvent(ctx, event.trip, event.previousTrip);
      return;
    case "trip_complete":
      return handleTripCompleteEvent(ctx, event.trip);
    default:
      return;
  }
};

/**
 * Handle arrive-dock event: compute at-dock predictions for the trip.
 *
 * Predicts AtDockArriveNext and AtDockDepartNext when vessel first
 * arrives at dock and trip is prediction-ready.
 *
 * @param ctx - Convex action context
 * @param trip - Current vessel trip state
 * @returns Trip with at-dock predictions applied
 */
const handleArriveDockEvent = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  return appendArriveDockPredictions(ctx, trip);
};

/**
 * Handle leave-dock event: actualize current predictions and backfill previous trip.
 *
 * 1. Actualizes AtDockDepartCurr and AtSeaArriveNext on current trip
 * 2. Inserts completed prediction records for current trip
 * 3. Backfills AtDockDepartNext and AtSeaDepartNext on previous trip
 * 4. Inserts prediction records for backfilled previous trip
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

  // 1. Actualize current trip predictions and extract records
  const actualizedTrip = actualizePredictionsWithLeftDock(trip, leftDockMs);
  await insertCompletedPredictions(ctx, actualizedTrip);

  // 2. Backfill previous trip's depart-next predictions
  if (previousTrip) {
    await backfillDepartNextPredictions(ctx, previousTrip, leftDockMs);
  }
};

/**
 * Handle trip-complete event: actualize at-sea predictions and insert records.
 *
 * Actualizes AtSeaArriveNext when trip completes, then inserts all
 * completed prediction records for the trip.
 *
 * @param ctx - Convex action context
 * @param trip - Completed vessel trip
 * @returns Trip with actualized predictions
 */
const handleTripCompleteEvent = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  // Actualize predictions for completed trip
  const actualizedTrip = actualizePredictionsForCompletedTrip(trip);

  // Insert completed prediction records
  await insertCompletedPredictions(ctx, actualizedTrip);

  return actualizedTrip;
};

/**
 * Compute leave-dock predictions for a trip.
 *
 * This is exposed for use in buildTrip when leaving dock.
 *
 * @param ctx - Convex action context
 * @param trip - Current vessel trip state
 * @returns Trip with leave-dock predictions applied
 */
export const computeLeaveDockPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  return appendLeaveDockPredictions(ctx, trip);
};

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Actualize predictions when vessel leaves dock.
 *
 * Updates AtDockDepartCurr (if LeftDock becomes known) and AtSeaArriveNext
 * (if trip ends and TripEnd becomes known). Returns trip with actuals applied.
 *
 * @param trip - Current trip state
 * @param leftDockMs - LeftDock timestamp in milliseconds
 * @returns Trip with actualized predictions
 */
const actualizePredictionsWithLeftDock = (
  trip: ConvexVesselTrip,
  leftDockMs: number
): ConvexVesselTrip => {
  const updatedTrip = { ...trip, LeftDock: leftDockMs };

  if (updatedTrip.AtDockDepartCurr) {
    updatedTrip.AtDockDepartCurr = applyActualToPrediction(
      updatedTrip.AtDockDepartCurr,
      leftDockMs
    );
  }

  return updatedTrip;
};

/**
 * Actualize predictions for completed trip.
 *
 * Updates AtSeaArriveNext when TripEnd becomes known.
 *
 * @param trip - Completed trip
 * @returns Trip with actualized predictions
 */
const actualizePredictionsForCompletedTrip = (
  trip: ConvexVesselTrip
): ConvexVesselTrip => {
  const updatedTrip = { ...trip };

  if (trip.TripEnd && trip.AtSeaArriveNext) {
    updatedTrip.AtSeaArriveNext = applyActualToPrediction(
      trip.AtSeaArriveNext,
      trip.TripEnd
    );
  }

  return updatedTrip;
};

/**
 * Apply actual observed timestamp to a prediction, calculating deltas.
 *
 * @param prediction - The prediction to update with actual data
 * @param actualMs - The actual observed timestamp in milliseconds
 * @returns Updated prediction with actual timestamp and calculated deltas
 */
const applyActualToPrediction = (
  prediction: {
    PredTime: number;
    MinTime: number;
    MaxTime: number;
    MAE: number;
    StdDev: number;
  },
  actualMs: number
): {
  PredTime: number;
  MinTime: number;
  MaxTime: number;
  MAE: number;
  StdDev: number;
  Actual: number;
  DeltaTotal: number;
  DeltaRange: number;
} => {
  const actual = Math.floor(actualMs / 1000) * 1000;
  const deltaRange = calculateDeltaRange(
    actual,
    prediction.MinTime,
    prediction.MaxTime
  );
  const deltaTotal = calculateDeltaTotal(actual, prediction.PredTime);

  return {
    ...prediction,
    Actual: actual,
    DeltaTotal: deltaTotal,
    DeltaRange: deltaRange,
  };
};

/**
 * Calculate the range deviation delta for a prediction.
 *
 * @param actual - Actual timestamp in milliseconds
 * @param min - Minimum prediction bound in milliseconds
 * @param max - Maximum prediction bound in milliseconds
 * @returns Delta in minutes (positive if actual > max, negative if actual < min, 0 if within bounds)
 */
const calculateDeltaRange = (
  actual: number,
  min: number,
  max: number
): number => {
  const MS_PER_MINUTE = 60 * 1000;
  if (actual < min)
    return Math.round(((actual - min) / MS_PER_MINUTE) * 10) / 10;
  if (actual > max)
    return Math.round(((actual - max) / MS_PER_MINUTE) * 10) / 10;
  return 0;
};

/**
 * Calculate the total prediction error delta.
 *
 * @param actual - Actual timestamp in milliseconds
 * @param predicted - Predicted timestamp in milliseconds
 * @returns Delta in minutes (actual - predicted)
 */
const calculateDeltaTotal = (actual: number, predicted: number): number => {
  const MS_PER_MINUTE = 60 * 1000;
  return Math.round(((actual - predicted) / MS_PER_MINUTE) * 10) / 10;
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
