// ============================================================================
// VESSEL TRIP PREDICTIONS
// Consolidated prediction logic for vessel trip ML models
// ============================================================================

import type { ActionCtx } from "_generated/server";
import type {
  ConvexPrediction,
  ConvexVesselTrip,
  PredictionReadyTrip,
} from "../../../functions/vesselTrips/schemas";
import type { ModelType } from "../shared/types";
import { predictTripValue } from "./predictTrip";

const MINUTES_TO_MS = 60 * 1000;

type PredictionField =
  | "AtDockDepartCurr"
  | "AtDockArriveNext"
  | "AtDockDepartNext"
  | "AtSeaArriveNext"
  | "AtSeaDepartNext";

type PredictionSpec = {
  field: PredictionField;
  modelType: ModelType;
  requiresLeftDock: boolean;
  getAnchorMs: (trip: ConvexVesselTrip) => number | null;
};

const PREDICTION_SPECS: Record<PredictionField, PredictionSpec> = {
  AtDockDepartCurr: {
    field: "AtDockDepartCurr",
    modelType: "at-dock-depart-curr",
    requiresLeftDock: false,
    getAnchorMs: (trip) => trip.ScheduledDeparture ?? null,
  },
  AtDockArriveNext: {
    field: "AtDockArriveNext",
    modelType: "at-dock-arrive-next",
    requiresLeftDock: false,
    getAnchorMs: (trip) => trip.ScheduledDeparture ?? null,
  },
  AtDockDepartNext: {
    field: "AtDockDepartNext",
    modelType: "at-dock-depart-next",
    requiresLeftDock: false,
    getAnchorMs: (trip) => trip.ScheduledTrip?.NextDepartingTime ?? null,
  },
  AtSeaArriveNext: {
    field: "AtSeaArriveNext",
    modelType: "at-sea-arrive-next",
    requiresLeftDock: true,
    getAnchorMs: (trip) => trip.LeftDock ?? null,
  },
  AtSeaDepartNext: {
    field: "AtSeaDepartNext",
    modelType: "at-sea-depart-next",
    requiresLeftDock: true,
    getAnchorMs: (trip) => trip.ScheduledTrip?.NextDepartingTime ?? null,
  },
};

/**
 * Gets the minimum scheduled time for a prediction type.
 * Returns null if no scheduled time is available.
 *
 * @param spec - Prediction specification
 * @param trip - Vessel trip data
 * @returns Minimum scheduled time in milliseconds, or null if not available
 */
const getMinimumScheduledTime = (
  spec: PredictionSpec,
  trip: ConvexVesselTrip
): number | null => {
  if (spec.field === "AtDockDepartCurr") {
    return trip.ScheduledDeparture ?? null;
  }
  if (spec.field === "AtDockDepartNext" || spec.field === "AtSeaDepartNext") {
    return trip.ScheduledTrip?.NextDepartingTime ?? null;
  }
  // AtDockArriveNext and AtSeaArriveNext don't have scheduled minimums
  return null;
};

/**
 * Creates a prediction result from ML prediction data
 */
const createPredictionResult = (
  predictedTime: number,
  mae: number,
  stdDev: number
): ConvexPrediction => {
  const predTime = Math.floor(predictedTime / 1000) * 1000;
  const stdDevMs = stdDev * 60 * 1000;

  return {
    PredTime: predTime,
    MinTime: Math.floor((predictedTime - stdDevMs) / 1000) * 1000,
    MaxTime: Math.floor((predictedTime + stdDevMs) / 1000) * 1000,
    MAE: mae,
    StdDev: stdDev,
    Actual: undefined,
    DeltaTotal: undefined,
    DeltaRange: undefined,
  };
};

const isPredictionReadyTrip = (
  trip: ConvexVesselTrip
): trip is PredictionReadyTrip =>
  Boolean(trip.TripStart) &&
  Boolean(trip.DepartingTerminalAbbrev) &&
  Boolean(trip.ArrivingTerminalAbbrev) &&
  Boolean(trip.PrevTerminalAbbrev) &&
  Boolean(trip.InService) &&
  Boolean(trip.ScheduledDeparture) &&
  Boolean(trip.PrevScheduledDeparture) &&
  Boolean(trip.PrevLeftDock);

/**
 * Determines if a prediction should be attempted based on throttling rules.
 *
 * Predictions are throttled to once per minute using time-based logic:
 * - AtDock predictions: run on first update with required fields OR every minute
 * - AtSea predictions: run on first update with LeftDock OR every minute
 * - Skip if prediction already exists
 *
 * @param spec - Prediction specification
 * @param trip - Current vessel trip state
 * @param existingTrip - Previous vessel trip state (for detecting first-time conditions)
 * @returns True if prediction should be attempted
 */
const shouldAttemptPrediction = (
  spec: PredictionSpec,
  trip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined
): boolean => {
  // Don't attempt if we already have a valid prediction
  if (trip[spec.field] !== undefined) {
    return false;
  }

  const seconds = new Date().getSeconds();
  const isThrottleWindow = seconds < 5; // Once per minute

  if (spec.requiresLeftDock) {
    // AtSea predictions: run on first LeftDock OR every minute
    const justLeftDock =
      existingTrip !== undefined &&
      existingTrip.LeftDock === undefined &&
      trip.LeftDock !== undefined;
    return justLeftDock || isThrottleWindow;
  } else {
    // If we just arrived at dock (at-sea -> at-dock), compute at-dock predictions immediately.
    const justArrivedDock =
      existingTrip !== undefined && !existingTrip.AtDock && trip.AtDock;
    if (justArrivedDock) {
      return true;
    }

    // AtDock predictions: run on first update with departure terminal OR every minute
    // Check if this is the first time we have required fields for predictions
    const hasRequiredFields = isPredictionReadyTrip(trip);
    const hadRequiredFields =
      existingTrip && isPredictionReadyTrip(existingTrip);
    const firstTimeWithFields = hasRequiredFields && !hadRequiredFields;
    return firstTimeWithFields || isThrottleWindow;
  }
};

const predictFromSpec = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  spec: PredictionSpec
): Promise<ConvexPrediction | null> => {
  if (!isPredictionReadyTrip(trip)) {
    return null;
  }

  if (spec.requiresLeftDock && !trip.LeftDock) {
    return null;
  }

  const anchorMs = spec.getAnchorMs(trip);
  if (!anchorMs) {
    return null;
  }

  try {
    const {
      predictedValue: predictedMinutes,
      mae,
      stdDev,
    } = await predictTripValue(ctx, trip, spec.modelType);

    const predictedMs = anchorMs + predictedMinutes * MINUTES_TO_MS;

    // Clamp prediction to minimum scheduled time if applicable
    const minimumScheduledTime = getMinimumScheduledTime(spec, trip);
    const clampedPredictedMs =
      minimumScheduledTime !== null
        ? Math.max(predictedMs, minimumScheduledTime)
        : predictedMs;

    return createPredictionResult(clampedPredictedMs, mae, stdDev);
  } catch (error) {
    console.error(
      `[Prediction] ${spec.modelType} failed for ${trip.VesselAbbrev}:`,
      error
    );
    return null;
  }
};

/**
 * Predict a single vessel trip prediction field.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - The trip to predict for
 * @param field - Prediction field to compute (e.g., \"AtDockArriveNext\")
 * @returns Prediction result or null if not ready / cannot be computed
 */
export const predictVesselTripPrediction = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  field: PredictionField
): Promise<ConvexPrediction | null> => {
  return await predictFromSpec(ctx, trip, PREDICTION_SPECS[field]);
};

/**
 * Compute prediction updates for a vessel trip with time-based throttling.
 *
 * Predictions are throttled to prevent repeated failures from being attempted
 * every 5 seconds. AtDock predictions run on first update with required fields
 * or every minute. AtSea predictions run on first update with LeftDock or every minute.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Current vessel trip state
 * @param existingTrip - Previous vessel trip state (optional, for detecting first-time conditions)
 * @returns Partial trip update with new predictions
 */
export const computeVesselTripPredictionsPatch = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  existingTrip?: ConvexVesselTrip
): Promise<Partial<ConvexVesselTrip>> => {
  const specsToAttempt = Object.values(PREDICTION_SPECS).filter((spec) =>
    shouldAttemptPrediction(spec, trip, existingTrip)
  );

  const results = await Promise.all(
    specsToAttempt.map(async (spec) => ({
      spec,
      prediction: await predictFromSpec(ctx, trip, spec),
    }))
  );

  const updates = results.reduce<
    Partial<Record<PredictionField, ConvexPrediction>>
  >((acc, { spec, prediction }) => {
    if (prediction) {
      acc[spec.field] = prediction;
    }
    return acc;
  }, {});

  return updates as Partial<ConvexVesselTrip>;
};

/**
 * Updates existing predictions with actual times and calculates deltas
 *
 * Note: "depart-next" prediction actualization is handled when the *next* trip
 * leaves dock (it becomes known as `LeftDock` on the next trip), via the
 * `setDepartNextActualsForMostRecentCompletedTrip` mutation. As a result, this
 * function only fills actuals that can be observed on the *same* trip record.
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
