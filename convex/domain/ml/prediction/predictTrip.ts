// ============================================================================
// FERRY TRIP PREDICTION ENGINE
// Real-time ML inference for departure delays and arrival estimates
// ============================================================================

/**
 * ## Prediction Engine Overview
 *
 * This module provides real-time ML inference capabilities for ferry schedule predictions.
 * It loads trained models from the database and applies them to current vessel conditions
 * to predict departure delays, arrival times, and journey durations.
 *
 * ## Prediction Types
 *
 * 1. **Departure Delay**: How long before vessel departs from current terminal
 * 2. **Arrival ETA**: When vessel will arrive at next terminal
 * 3. **Journey Duration**: Total time for complete trip segment
 *
 * ## Model Loading Strategy
 *
 * - **Database Storage**: Trained models persisted in Convex database
 * - **Route-Specific**: Separate models for each terminal pair
 * - **Caching**: Models loaded once and reused for efficiency
 *
 * ## Feature Engineering
 *
 * Predictions use the same feature engineering as training:
 * - Time-of-day patterns (radial basis functions)
 * - Historical duration averages
 * - Schedule adherence metrics
 * - Previous trip performance
 *
 * ## Error Handling
 *
 * - **Missing Models**: Falls back gracefully when no trained model available
 * - **Invalid Data**: Validates input before making predictions
 * - **Performance Bounds**: Includes model uncertainty metrics (MAE)
 */

import { api } from "_generated/api";
import type { ActionCtx, MutationCtx } from "_generated/server";
import { roundToPrecision } from "shared";
import type { ConvexVesselTrip } from "../../../functions/vesselTrips/schemas";
import { config, formatTerminalPairKey } from "../shared/config";
import { createFeatureRecord } from "../shared/featureRecord";
import { models } from "../shared/models";
import type {
  ModelType,
  TerminalPairKey,
  TrainingWindow,
} from "../shared/types";
import { predictWithModel } from "./applyModel";

type ModelDoc = {
  featureKeys: string[];
  coefficients: number[];
  intercept: number;
  testMetrics: {
    mae: number;
    stdDev: number;
  };
};

/**
 * Type guard to check if context is a mutation context.
 *
 * @param ctx - Convex execution context to check
 * @returns True if context has direct database access (mutation context)
 */
const isMutationCtx = (ctx: ActionCtx | MutationCtx): ctx is MutationCtx =>
  // Mutations have direct DB access; actions do not.
  "db" in ctx;

/**
 * Load trained ML model for specific route and prediction type.
 * Uses the active production version from config for predictions.
 *
 * Handles different Convex contexts (actions vs mutations) which have
 * different APIs for database access. Actions must use queries while
 * mutations can access database directly.
 *
 * @param ctx - Convex execution context (action or mutation)
 * @param pairKey - Terminal pair identifier (e.g., "BBI->P52")
 * @param modelType - Type of prediction model needed
 * @returns Trained model parameters or null if not found
 */
const loadModelForPair = async (
  ctx: ActionCtx | MutationCtx,
  pairKey: string,
  modelType: ModelType
): Promise<ModelDoc | null> => {
  if (isMutationCtx(ctx)) {
    // Mutations have direct database access
    // Get production version tag from config
    const config = await ctx.db
      .query("modelConfig")
      .withIndex("by_key", (q) => q.eq("key", "productionVersionTag"))
      .first();

    const prodVersionTag = config?.productionVersionTag;
    if (!prodVersionTag) {
      // Fallback: try to find any model (for backward compatibility)
      const doc = await ctx.db
        .query("modelParameters")
        .withIndex("by_pair_and_type", (q) =>
          q.eq("pairKey", pairKey).eq("modelType", modelType)
        )
        .first();
      return doc as ModelDoc | null;
    }

    // Query with production version tag
    const doc = await ctx.db
      .query("modelParameters")
      .withIndex("by_pair_type_tag", (q) =>
        q
          .eq("pairKey", pairKey)
          .eq("modelType", modelType)
          .eq("versionTag", prodVersionTag)
      )
      .first();
    return doc as ModelDoc | null;
  }

  // Actions don't have direct DB access - use production query
  const doc = await ctx.runQuery(
    api.functions.predictions.queries.getModelParametersForProduction,
    { pairKey, modelType }
  );
  return doc as ModelDoc | null;
};

/**
 * Load multiple ML models for a terminal pair in one query.
 * Used when computing multiple predictions for a vessel to reduce Convex function calls.
 *
 * @param ctx - Convex action context (mutations use direct DB, not this)
 * @param pairKey - Terminal pair identifier
 * @param modelTypes - Array of model types to load
 * @returns Record mapping model type to model doc (null if not found)
 */
export const loadModelsForPairBatch = async (
  ctx: ActionCtx,
  pairKey: string,
  modelTypes: ModelType[]
): Promise<Record<ModelType, ModelDoc | null>> => {
  if (modelTypes.length === 0) {
    return {} as Record<ModelType, ModelDoc | null>;
  }

  const batch = await ctx.runQuery(
    api.functions.predictions.queries.getModelParametersForProductionBatch,
    { pairKey, modelTypes }
  );

  return batch as Record<ModelType, ModelDoc | null>;
};

const requireTripField = <T>(
  value: T | null | undefined,
  message: string
): T => {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
};

/**
 * Calculate time difference in minutes between two timestamps.
 *
 * @param earlierMs - Earlier timestamp in milliseconds
 * @param laterMs - Later timestamp in milliseconds
 * @returns Time difference in minutes
 */
const minutesBetween = (earlierMs: number, laterMs: number): number =>
  (laterMs - earlierMs) / 60000;

/**
 * Convert Convex trip data to ML training window format.
 *
 * Transforms the database representation of a vessel trip into the
 * structured format expected by the ML feature extraction pipeline.
 * This enables real-time predictions using the same feature engineering
 * as training.
 *
 * @param trip - Vessel trip data from Convex database
 * @returns Structured training window for feature extraction
 */
const toTrainingWindow = (trip: ConvexVesselTrip): TrainingWindow => {
  const A = requireTripField(
    trip.PrevTerminalAbbrev,
    "Missing PrevTerminalAbbrev"
  );
  const B = requireTripField(
    trip.DepartingTerminalAbbrev,
    "Missing DepartingTerminalAbbrev"
  );
  const C = requireTripField(
    trip.ArrivingTerminalAbbrev,
    "Missing ArrivingTerminalAbbrev"
  );

  const tripStartMs = requireTripField(trip.TripStart, "Missing TripStart");
  const prevScheduledMs = requireTripField(
    trip.PrevScheduledDeparture,
    "Missing PrevScheduledDeparture"
  );
  const prevLeftDockMs = requireTripField(
    trip.PrevLeftDock,
    "Missing PrevLeftDock"
  );
  const scheduledDepartMs = requireTripField(
    trip.ScheduledDeparture,
    "Missing ScheduledDeparture"
  );

  const currPairKey = formatTerminalPairKey(B, C) as TerminalPairKey;
  const meanAtDockMinutesForCurrPair =
    config.getMeanAtDockDuration(currPairKey);

  const slackBeforeCurrScheduledDepartMinutes = Math.max(
    0,
    minutesBetween(tripStartMs, scheduledDepartMs)
  );

  return {
    kind: "no_depart_c",
    vesselAbbrev: trip.VesselAbbrev,
    prevTerminalAbbrev: A,
    currTerminalAbbrev: B,
    nextTerminalAbbrev: C,
    prevLeg: {
      fromTerminalAbbrev: A,
      toTerminalAbbrev: B,
      scheduledDepartMs: prevScheduledMs,
      actualDepartMs: prevLeftDockMs,
      arrivalProxyMs: tripStartMs,
      arrivalProxySource: "wsf_est_arrival",
    },
    currLeg: {
      fromTerminalAbbrev: B,
      toTerminalAbbrev: C,
      scheduledDepartMs,
      actualDepartMs: trip.LeftDock ?? scheduledDepartMs,
    },
    currPairKey,
    slackBeforeCurrScheduledDepartMinutes,
    meanAtDockMinutesForCurrPair,
    currScheduledDepartMs: scheduledDepartMs,
    // Inference doesn't have VesselHistory records (only training does)
    prevHistory: null,
    currHistory: null as any, // Required field but not available during inference
    nextHistory: null,
  };
};

/**
 * Generic prediction function for vessel trip models
 *
 * Loads the appropriate ML model for the terminal pair and model type,
 * extracts features from the trip data, and returns the predicted value
 * along with the model's training MAE for uncertainty indication.
 *
 * When preloadedModel is provided (e.g. from batch load), uses it instead
 * of querying the database—reduces Convex function calls when computing
 * multiple predictions for the same vessel.
 *
 * @param ctx - Convex action/mutation context
 * @param trip - Vessel trip data
 * @param modelType - Type of ML model to use for prediction
 * @param preloadedModel - Optional pre-loaded model (avoids query when batch loading)
 * @returns Object containing predicted value and model MAE
 * @throws Error if required trip data is missing or model not found
 */
export const predictTripValue = async (
  ctx: ActionCtx | MutationCtx,
  trip: ConvexVesselTrip,
  modelType: ModelType,
  preloadedModel?: ModelDoc | null
): Promise<{
  predictedValue: number;
  mae: number;
  stdDev: number;
}> => {
  // Identify the route for model lookup
  const arriving = requireTripField(
    trip.ArrivingTerminalAbbrev,
    "Missing ArrivingTerminalAbbrev"
  );
  const pairKey = formatTerminalPairKey(trip.DepartingTerminalAbbrev, arriving);

  // Use preloaded model when available; otherwise load from DB
  const model =
    preloadedModel !== undefined
      ? preloadedModel
      : await loadModelForPair(ctx, pairKey, modelType);
  if (!model) {
    throw new Error(`No trained model found for ${pairKey} ${modelType}`);
  }

  // Convert trip data to ML format and extract features
  const window = toTrainingWindow(trip);
  const modelDefinition = models[modelType];
  const record = createFeatureRecord(window);
  const featureValues = modelDefinition.extractFeatures(record);

  // Create feature vector in the same order as model training
  const featureArray = model.featureKeys.map((key) => featureValues[key] ?? 0);

  // Apply linear regression: prediction = coefficients · features + intercept
  const predictedValue = predictWithModel(
    featureArray,
    model.coefficients,
    model.intercept
  );

  // Return prediction with uncertainty metrics (MAE and Std Dev from training)
  return {
    predictedValue: roundToPrecision(predictedValue, 1), // Round to 1 decimal place
    mae: roundToPrecision(model.testMetrics.mae, 1), // Mean Absolute Error
    stdDev: roundToPrecision(model.testMetrics.stdDev, 1), // Standard deviation of errors
  };
};

/**
 * Predicts arrival ETA using the arrive-arrive-total-duration model
 *
 * Uses the arrive-arrive-total-duration model to predict total duration from departure to arrival,
 * then calculates the predicted arrival time as departure time + predicted duration.
 *
 * @param ctx - Convex action/mutation context
 * @param trip - Vessel trip data (must have LeftDock set)
 * @returns Object containing predicted arrival time and model MAE
 * @throws Error if LeftDock is missing or prediction fails
 */
export const predictArriveEta = async (
  ctx: ActionCtx | MutationCtx,
  trip: ConvexVesselTrip
): Promise<{
  predictedTime: number;
  mae: number;
  stdDev: number;
}> => {
  if (!trip.LeftDock) {
    throw new Error(
      "Cannot predict ETA: vessel has not departed (LeftDock is missing)"
    );
  }

  // Predict minutes from actual departure at Curr to arrival at Next.
  const {
    predictedValue: predictedDuration,
    mae,
    stdDev,
  } = await predictTripValue(ctx, trip, "at-sea-arrive-next");

  // Calculate predicted arrival time (departure time + predicted duration)
  const predictedArrivalTime = trip.LeftDock + predictedDuration * 60000; // Convert minutes to milliseconds

  return {
    predictedTime: predictedArrivalTime,
    mae,
    stdDev,
  };
};

/**
 * Predicts departure delay when vessel arrives at terminal
 *
 * Uses the arrive-depart-delay model to predict how much delay there will be
 * before the vessel departs from the current terminal.
 *
 * @param ctx - Convex action/mutation context
 * @param trip - Vessel trip data
 * @returns Object containing predicted delay duration and model MAE
 * @throws Error if prediction fails
 */
export const predictDelayOnArrival = async (
  ctx: ActionCtx | MutationCtx,
  trip: ConvexVesselTrip
): Promise<{
  predictedTime: number;
  mae: number;
  stdDev: number;
}> => {
  // Predict minutes of delay from scheduled departure at Curr to actual departure.
  const {
    predictedValue: predictedDelay,
    mae,
    stdDev,
  } = await predictTripValue(ctx, trip, "at-dock-depart-curr");

  return {
    predictedTime: predictedDelay,
    mae,
    stdDev,
  };
};

/**
 * Predicts departure ETA for a vessel at dock
 *
 * Uses the arrive-depart-delay model to predict delay, then calculates the
 * predicted departure time as scheduled departure + predicted delay.
 *
 * @param ctx - Convex action/mutation context
 * @param trip - Vessel trip data (must have ScheduledDeparture set)
 * @returns Object containing predicted departure time and model MAE
 * @throws Error if ScheduledDeparture is missing or prediction fails
 */
export const predictEtaOnDeparture = async (
  ctx: ActionCtx | MutationCtx,
  trip: ConvexVesselTrip
): Promise<{
  predictedTime: number;
  mae: number;
  stdDev: number;
}> => {
  if (!trip.ScheduledDeparture) {
    throw new Error(
      "Cannot predict departure ETA: scheduled departure time is missing"
    );
  }

  // Predict delay minutes, then convert to an absolute departure timestamp.
  const {
    predictedValue: predictedDelay,
    mae,
    stdDev,
  } = await predictTripValue(ctx, trip, "at-dock-depart-curr");

  // Calculate predicted departure time (scheduled departure + predicted delay)
  const predictedDepartureTime =
    trip.ScheduledDeparture + predictedDelay * 60 * 1000; // Convert delay from minutes to milliseconds

  return {
    predictedTime: predictedDepartureTime,
    mae,
    stdDev,
  };
};
