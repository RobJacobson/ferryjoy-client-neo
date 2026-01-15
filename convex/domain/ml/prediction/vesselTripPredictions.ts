// ============================================================================
// VESSEL TRIP PREDICTIONS
// Consolidated prediction logic for vessel trip ML models
// ============================================================================

import type { ActionCtx } from "_generated/server";
import type {
  ConvexPrediction,
  ConvexVesselTrip,
} from "../../../functions/vesselTrips/schemas";
import {
  predictArriveEta,
  predictDelayOnArrival,
  predictTripValue,
} from "./predictTrip";

const MINUTES_TO_MS = 60 * 1000;

/**
 * Creates a prediction result from ML prediction data
 */
const createPredictionResult = (
  predictedTime: number,
  stdDev: number
): ConvexPrediction => {
  const predTime = Math.floor(predictedTime / 1000) * 1000;
  const stdDevMs = stdDev * 60 * 1000;

  return {
    PredTime: predTime,
    MinTime: Math.floor((predictedTime - stdDevMs) / 1000) * 1000,
    MaxTime: Math.floor((predictedTime + stdDevMs) / 1000) * 1000,
    Actual: undefined,
    DeltaTotal: undefined,
    DeltaRange: undefined,
  };
};

/**
 * Predicts departure delay from current terminal using at-dock context.
 * Uses at-dock-depart-curr model.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict for
 * @returns Promise resolving to departure prediction result
 */
export const predictAtDockDepartCurr = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexPrediction | null> => {
  if (!hasPredictionData(trip, false)) {
    return null;
  }

  try {
    const prediction = await predictDelayOnArrival(ctx, trip);
    const predictedDelayMinutes = prediction.predictedTime;
    const predictedDelayMs = predictedDelayMinutes * 60 * 1000;
    const predTime = (trip.ScheduledDeparture as number) + predictedDelayMs;

    return createPredictionResult(predTime, prediction.stdDev);
  } catch (error) {
    console.error(
      `[Prediction] At-dock depart curr failed for ${trip.VesselAbbrev}:`,
      error
    );
    return null;
  }
};

/**
 * Predicts arrival time at next terminal using at-dock context.
 * Uses at-dock-arrive-next model.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict for
 * @returns Promise resolving to arrival prediction result
 */
export const predictAtDockArriveNext = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexPrediction | null> => {
  if (!hasPredictionData(trip, false)) {
    return null;
  }

  try {
    // Model predicts minutes from Curr scheduled departure to arrival at Next.
    const { predictedValue: predictedMinutes, stdDev } = await predictTripValue(
      ctx,
      trip,
      "at-dock-arrive-next"
    );

    const scheduledDepartMs = trip.ScheduledDeparture as number;
    const predictedArrivalMs =
      scheduledDepartMs + predictedMinutes * MINUTES_TO_MS;

    return createPredictionResult(predictedArrivalMs, stdDev);
  } catch (error) {
    console.error(
      `[Prediction] At-dock arrive next failed for ${trip.VesselAbbrev}:`,
      error
    );
    return null;
  }
};

/**
 * Predicts departure delay from next terminal using at-dock context.
 * Uses at-dock-depart-next model.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict for
 * @returns Promise resolving to next departure prediction result
 */
export const predictAtDockDepartNext = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexPrediction | null> => {
  void ctx;
  void trip;

  // NOTE: The depart-next models predict minutes relative to Next's scheduled
  // departure, but the active trip record does not currently include Next's
  // scheduled departure timestamp. Until we add that field, we cannot store a
  // unit-correct `ConvexPrediction` (which is epoch-ms-based).
  return null;
};

/**
 * Predicts arrival time at next terminal using at-sea context.
 * Uses at-sea-arrive-next model.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict for (must have LeftDock)
 * @returns Promise resolving to arrival prediction result
 */
export const predictAtSeaArriveNext = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexPrediction | null> => {
  if (!trip.LeftDock || !hasPredictionData(trip, true)) {
    return null;
  }

  try {
    const prediction = await predictArriveEta(ctx, trip);
    return createPredictionResult(prediction.predictedTime, prediction.stdDev);
  } catch (error) {
    console.error(
      `[Prediction] At-sea arrive next failed for ${trip.VesselAbbrev}:`,
      error
    );
    return null;
  }
};

/**
 * Predicts departure delay from next terminal using at-sea context.
 * Uses at-sea-depart-next model.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict for (must have LeftDock)
 * @returns Promise resolving to next departure prediction result
 */
export const predictAtSeaDepartNext = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip
): Promise<ConvexPrediction | null> => {
  void ctx;
  void trip;

  // See note in `predictAtDockDepartNext`.
  return null;
};

/**
 * Updates existing predictions with actual times and calculates deltas
 *
 * @param existingTrip - The previous trip state
 * @param updatedTrip - The updated trip state
 * @returns Partial trip updates with calculated deltas
 */
export const updatePredictionsWithActuals = (
  existingTrip: ConvexVesselTrip,
  updatedTrip: ConvexVesselTrip
): Partial<ConvexVesselTrip> => {
  const updates: Partial<ConvexVesselTrip> = {};

  // Update AtDockDepartCurr prediction when vessel leaves dock
  if (
    !existingTrip.LeftDock &&
    updatedTrip.LeftDock &&
    updatedTrip.AtDockDepartCurr
  ) {
    const actual = Math.floor(updatedTrip.LeftDock / 1000) * 1000; // Round down to seconds
    const deltaRange = calculateDeltaRange(
      actual,
      updatedTrip.AtDockDepartCurr.MinTime,
      updatedTrip.AtDockDepartCurr.MaxTime
    );
    const deltaTotal = calculateDeltaTotal(
      actual,
      updatedTrip.AtDockDepartCurr.PredTime
    );

    updates.AtDockDepartCurr = {
      ...updatedTrip.AtDockDepartCurr,
      Actual: actual,
      DeltaTotal: deltaTotal,
      DeltaRange: deltaRange,
    };
  }

  // Update AtSeaArriveNext prediction when vessel arrives at next terminal
  if (
    !existingTrip.TripEnd &&
    updatedTrip.TripEnd &&
    updatedTrip.AtSeaArriveNext
  ) {
    const actual = Math.floor(updatedTrip.TripEnd / 1000) * 1000; // Round down to seconds
    const deltaRange = calculateDeltaRange(
      actual,
      updatedTrip.AtSeaArriveNext.MinTime,
      updatedTrip.AtSeaArriveNext.MaxTime
    );
    const deltaTotal = calculateDeltaTotal(
      actual,
      updatedTrip.AtSeaArriveNext.PredTime
    );

    updates.AtSeaArriveNext = {
      ...updatedTrip.AtSeaArriveNext,
      Actual: actual,
      DeltaTotal: deltaTotal,
      DeltaRange: deltaRange,
    };
  }

  // Update AtDockDepartNext prediction when vessel departs next terminal
  if (
    existingTrip.TripEnd &&
    !existingTrip.ArrivingTerminalAbbrev &&
    updatedTrip.ArrivingTerminalAbbrev &&
    updatedTrip.AtDockDepartNext
  ) {
    // This is when we complete the trip at the next terminal
    // We don't have the actual departure time from the next terminal in this trip record
    // That would be in the next trip's LeftDock field
  }

  return updates;
};

/**
 * Calculate delta in minutes from prediction bounds
 *
 * @param actual - Actual time in milliseconds
 * @param min - Minimum predicted time in milliseconds
 * @param max - Maximum predicted time in milliseconds
 * @returns Delta in minutes, rounded to 1 decimal place
 */
const calculateDeltaRange = (
  actual: number,
  min: number,
  max: number
): number => {
  const MS_PER_MINUTE = 60 * 1000;
  if (actual < min)
    return Math.round(((actual - min) / MS_PER_MINUTE) * 10) / 10; // Early
  if (actual > max)
    return Math.round(((actual - max) / MS_PER_MINUTE) * 10) / 10; // Late
  return 0; // Within prediction range
};

/**
 * Calculate total delta between actual and predicted times
 *
 * @param actual - Actual time in milliseconds
 * @param predicted - Predicted time in milliseconds
 * @returns Delta in minutes, rounded to 1 decimal place
 */
const calculateDeltaTotal = (actual: number, predicted: number): number => {
  const MS_PER_MINUTE = 60 * 1000;
  return Math.round(((actual - predicted) / MS_PER_MINUTE) * 10) / 10;
};

/**
 * Checks if trip has all required data for making predictions
 *
 * @param trip - The trip to check
 * @param leftDockRequired - Whether LeftDock is required for prediction
 * @returns True if trip has sufficient data for predictions
 */
const hasPredictionData = (
  trip: ConvexVesselTrip,
  leftDockRequired: boolean
): boolean =>
  Boolean(trip.TripStart) &&
  Boolean(trip.ArrivingTerminalAbbrev) &&
  Boolean(trip.InService) &&
  Boolean(trip.ScheduledDeparture) &&
  Boolean(trip.PrevScheduledDeparture) &&
  Boolean(trip.PrevLeftDock) &&
  (!leftDockRequired || Boolean(trip.LeftDock));
