// ============================================================================
// VESSEL TRIP PREDICTIONS
// Core ML prediction logic for vessel trip predictions
// ============================================================================

import type { ActionCtx } from "_generated/server";
import type {
  ConvexJoinedTripPrediction,
  ConvexPrediction,
  ConvexVesselTrip,
  ConvexVesselTripWithML,
  PredictionReadyTrip,
} from "../../../functions/vesselTrips/schemas";
import type { ModelType } from "../shared/types";
import { predictTripValue } from "./predictTrip";

const MINUTES_TO_MS = 60 * 1000;

/**
 * Prediction-bearing fields attached to an active vessel trip.
 */
export type PredictionField =
  | "AtDockDepartCurr"
  | "AtDockArriveNext"
  | "AtDockDepartNext"
  | "AtSeaArriveNext"
  | "AtSeaDepartNext";

/**
 * Declarative description of how to compute one prediction field.
 */
export type PredictionSpec = {
  field: PredictionField;
  modelType: ModelType;
  requiresLeftDock: boolean;
  getAnchorMs: (trip: ConvexVesselTripWithML) => number | null;
};

/**
 * Registry of supported trip prediction fields and their model wiring.
 */
export const PREDICTION_SPECS: Record<PredictionField, PredictionSpec> = {
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
    getAnchorMs: (trip) => trip.NextScheduledDeparture ?? null,
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
    getAnchorMs: (trip) => trip.NextScheduledDeparture ?? null,
  },
};

/**
 * Type guard for trips that are ready for predictions.
 *
 * A trip is prediction-ready when it has all required context fields:
 * TripStart, DepartingTerminalAbbrev, ArrivingTerminalAbbrev,
 * PrevTerminalAbbrev, InService, ScheduledDeparture,
 * PrevScheduledDeparture, and PrevLeftDock.
 *
 * @param trip - Vessel trip data
 * @returns True if trip has all required fields for predictions
 */
export const isPredictionReadyTrip = (
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
 * Gets the minimum scheduled time for a prediction type.
 * Returns null if no scheduled time is available.
 *
 * @param spec - Prediction specification
 * @param trip - Vessel trip data
 * @returns Minimum scheduled time in milliseconds, or null if not available
 */
export const getMinimumScheduledTime = (
  spec: PredictionSpec,
  trip: ConvexVesselTripWithML
): number | null => {
  if (spec.field === "AtDockDepartCurr") {
    return trip.ScheduledDeparture ?? null;
  }
  if (spec.field === "AtDockDepartNext" || spec.field === "AtSeaDepartNext") {
    return trip.NextScheduledDeparture ?? null;
  }
  // AtDockArriveNext and AtSeaArriveNext don't have scheduled minimums
  return null;
};

/**
 * Creates a prediction result from ML prediction data
 *
 * @param predictedTime - Predicted time in milliseconds
 * @param mae - Mean absolute error in minutes
 * @param stdDev - Standard deviation in minutes
 * @returns Convex prediction object
 */
export const createPredictionResult = (
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

/**
 * Apply an observed timestamp to a prediction and compute error deltas.
 *
 * @param prediction - Existing prediction to actualize (full ML or joined minimal)
 * @param actualMs - Observed timestamp in milliseconds
 * @returns Same shape as input: full ML includes optional `DeltaRange` when an
 * interval exists; joined minimal rows stay minimal (no synthetic MAE/StdDev).
 */
export const applyActualToPrediction = (
  prediction: ConvexPrediction | ConvexJoinedTripPrediction,
  actualMs: number
): ConvexPrediction | ConvexJoinedTripPrediction => {
  const actual = Math.floor(actualMs / 1000) * 1000;
  const deltaTotal = calculateDeltaTotal(actual, prediction.PredTime);

  const isFullMl = "MinTime" in prediction && prediction.MinTime !== undefined;

  if (!isFullMl) {
    return {
      PredTime: prediction.PredTime,
      Actual: actual,
      DeltaTotal: deltaTotal,
    };
  }

  const full = prediction as ConvexPrediction;
  const hasInterval = full.MinTime !== undefined && full.MaxTime !== undefined;

  return {
    ...full,
    Actual: actual,
    DeltaTotal: deltaTotal,
    ...(hasInterval
      ? {
          DeltaRange: calculateDeltaRange(actual, full.MinTime, full.MaxTime),
        }
      : {}),
  };
};

/**
 * Actualize same-trip predictions when a vessel leaves dock.
 *
 * @param trip - Active trip with LeftDock populated
 * @returns Trip with leave-dock actuals applied
 */
export const actualizePredictionsOnLeaveDock = (
  trip: ConvexVesselTripWithML
): ConvexVesselTripWithML => {
  if (!trip.LeftDock || !trip.AtDockDepartCurr) {
    return trip;
  }

  return {
    ...trip,
    AtDockDepartCurr: applyActualToPrediction(
      trip.AtDockDepartCurr,
      trip.LeftDock
    ),
  };
};

/**
 * Actualize same-trip predictions when a trip completes.
 *
 * @param trip - Completed trip with TripEnd populated
 * @returns Trip with trip-complete actuals applied
 */
export const actualizePredictionsOnTripComplete = (
  trip: ConvexVesselTripWithML
): ConvexVesselTripWithML => {
  const arrivalActual = trip.ArriveDest ?? trip.TripEnd;
  if (!arrivalActual || !trip.AtSeaArriveNext) {
    return trip;
  }

  return {
    ...trip,
    AtSeaArriveNext: applyActualToPrediction(
      trip.AtSeaArriveNext,
      arrivalActual
    ),
  };
};

/**
 * Predict a single vessel trip prediction field from its specification.
 *
 * Validates trip readiness, checks for required fields (LeftDock), computes
 * anchor time, and runs ML model. Returns null if prediction cannot be
 * computed.
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Vessel trip data
 * @param spec - Prediction specification
 * @param preloadedModel - Optional preloaded model document for batch loading
 * @returns Prediction result or null if not ready / cannot be computed
 */
export const predictFromSpec = async (
  ctx: ActionCtx,
  trip: ConvexVesselTripWithML,
  spec: PredictionSpec,
  preloadedModel?: {
    featureKeys: string[];
    coefficients: number[];
    intercept: number;
    testMetrics: { mae: number; stdDev: number };
  } | null
): Promise<ConvexPrediction | null> => {
  if (!isPredictionReadyTrip(trip)) {
    return null;
  }

  if (spec.requiresLeftDock && !trip.LeftDock) {
    return null;
  }

  // AtDockDepartNext and AtSeaDepartNext require NextScheduledDeparture to compute anchor time
  if (
    (spec.field === "AtDockDepartNext" || spec.field === "AtSeaDepartNext") &&
    !trip.NextScheduledDeparture
  ) {
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
    } = await predictTripValue(ctx, trip, spec.modelType, preloadedModel);

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
 * Delta in minutes between actual and predicted instants (rounded to 0.1).
 *
 * @param actual - Actual time in milliseconds
 * @param predicted - Predicted time in milliseconds
 * @returns Delta in minutes
 */
export const calculateDeltaTotal = (
  actual: number,
  predicted: number
): number => {
  const MS_PER_MINUTE = 60 * 1000;
  return Math.round(((actual - predicted) / MS_PER_MINUTE) * 10) / 10;
};
