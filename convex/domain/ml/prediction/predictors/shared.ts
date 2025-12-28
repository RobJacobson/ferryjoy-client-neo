// ============================================================================
// PREDICTION UTILITIES
// Core prediction functions and feature extractors
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import { formatTerminalPairKey } from "../../shared/core/config";
import type { ModelType } from "../../shared/core/modelTypes";
import { extractFeatures } from "../../shared/features/extractFeatures";
import { loadModel } from "../../training/models/loadModel";
import {
  applyLinearRegression,
  validatePredictionTime,
} from "../predictLinearRegression";
import type { PredictionResult } from "./types";

/**
 * Extract features with comprehensive error handling and validation
 * @param modelType - The type of model for which to extract features
 * @param params - Raw parameters to convert into feature vector
 * @returns Normalized feature record as key-value pairs
 * @throws Error if feature extraction fails due to invalid parameters
 */
const extractFeaturesSafe = (
  modelType: ModelType,
  params: Record<string, unknown>
): Record<string, number> => {
  try {
    return extractFeatures(modelType, params);
  } catch (error) {
    throw new Error(`Feature extraction failed: ${error}`);
  }
};

/**
 * Make a machine learning prediction for ferry schedule timing
 *
 * This function orchestrates the complete prediction pipeline:
 * 1. Load the appropriate trained model for the terminal pair
 * 2. Extract and normalize features from input parameters
 * 3. Apply linear regression to get duration prediction
 * 4. Convert duration to absolute timestamp with validation
 * 5. Return prediction result with confidence metrics
 *
 * @param ctx - Convex context for database operations
 * @param modelType - Type of prediction model to use
 * @param departingTerminal - Abbreviation of departure terminal
 * @param arrivingTerminal - Abbreviation of arrival terminal
 * @param features - Raw feature parameters for prediction
 * @param convertToTime - Function to convert predicted duration to absolute time
 * @returns Promise resolving to prediction result with timestamp and accuracy metrics
 * @throws Error if model not found or prediction fails
 */
export const makePrediction = async (
  ctx: ActionCtx | MutationCtx,
  modelType: ModelType,
  departingTerminal: string,
  arrivingTerminal: string,
  features: Record<string, unknown>,
  convertToTime: (duration: number) => {
    absoluteTime: number;
    referenceTime: number;
    minimumGap: number;
  }
): Promise<PredictionResult> => {
  // Load trained model for this terminal pair and model type
  const model = await loadModel(
    ctx,
    departingTerminal,
    arrivingTerminal,
    modelType
  );
  if (!model) {
    throw new Error(`Model not found for ${modelType}`);
  }

  // Extract and normalize features using the same logic as training
  const featureRecord = extractFeaturesSafe(modelType, features);

  // Apply linear regression with trained coefficients and intercept
  const predictedDuration = applyLinearRegression(model, featureRecord);

  // Convert predicted duration to absolute timestamp using prediction-specific logic
  const { absoluteTime, referenceTime, minimumGap } =
    convertToTime(predictedDuration);

  // Validate prediction time and apply business rule constraints
  const validatedTime = validatePredictionTime(
    absoluteTime,
    referenceTime,
    minimumGap
  );

  return {
    predictedTime: validatedTime,
    mae: model.trainingMetrics.mae,
  };
};

/**
 * Common feature extraction patterns for different prediction contexts
 * These utilities standardize feature extraction across different predictor functions
 */
export const featureExtractors = {
  /**
   * Extract features for arrival-based predictions (delay prediction, ETA on arrival)
   *
   * Used when vessel has arrived at terminal and we want to predict:
   * - How long the delay will be before departure
   * - When the vessel will actually depart
   *
   * @param ctx - Context containing terminal information and vessel state
   * @param ctx.departingTerminal - Terminal where vessel is currently located
   * @param ctx.arrivingTerminal - Terminal where vessel is headed
   * @param ctx.scheduledDeparture - Scheduled departure timestamp
   * @param ctx.prevDelay - Delay from previous trip (minutes)
   * @param ctx.prevAtSeaDuration - Duration of previous at-sea segment (minutes)
   * @param ctx.tripStart - When current trip started (arrival time at terminal)
   * @returns Normalized feature parameters for model input
   */
  arrivalBased: (ctx: {
    departingTerminal: string;
    arrivingTerminal: string;
    scheduledDeparture?: number;
    prevDelay?: number;
    prevAtSeaDuration?: number;
    tripStart?: number;
  }) => {
    const terminalPairKey = formatTerminalPairKey(
      ctx.departingTerminal,
      ctx.arrivingTerminal
    );

    return {
      scheduledDeparture: ctx.scheduledDeparture,
      prevDelay: ctx.prevDelay,
      prevAtSeaDuration: ctx.prevAtSeaDuration,
      tripStart: ctx.tripStart,
      terminalPairKey,
    };
  },

  /**
   * Extract features for departure-based predictions (ETA on departure)
   *
   * Used when vessel has departed terminal and we want to predict:
   * - How long it will take to reach the destination terminal
   * - When the vessel will arrive at destination
   *
   * @param ctx - Context containing departure conditions
   * @param ctx.scheduledDeparture - When vessel was scheduled to depart
   * @param ctx.atDockDuration - How long vessel spent at dock before departure
   * @param ctx.delay - Current delay from schedule (minutes)
   * @returns Normalized feature parameters for model input
   */
  departureBased: (ctx: {
    scheduledDeparture?: number;
    atDockDuration?: number;
    delay?: number;
  }) => ({
    scheduledDeparture: ctx.scheduledDeparture,
    atDockDuration: ctx.atDockDuration,
    delay: ctx.delay,
  }),
};

/**
 * Common time conversion patterns for different prediction types
 * These utilities convert model output durations to absolute timestamps
 */
export const timeConverters = {
  /**
   * Convert predicted delay duration to absolute departure timestamp
   *
   * @param delayMinutes - Predicted delay in minutes
   * @param scheduledDeparture - Original scheduled departure time
   * @returns Time conversion parameters for validation
   */
  delayToDeparture: (delayMinutes: number, scheduledDeparture: number) => ({
    absoluteTime: scheduledDeparture + delayMinutes * 60000,
    referenceTime: scheduledDeparture,
    minimumGap: 2,
  }),

  /**
   * Convert predicted total trip duration to absolute arrival timestamp
   *
   * @param durationMinutes - Predicted total trip duration (dock + sea time)
   * @param tripStart - When the trip started (arrival at departure terminal)
   * @returns Time conversion parameters for validation
   */
  combinedToArrival: (durationMinutes: number, tripStart: number) => ({
    absoluteTime: tripStart + durationMinutes * 60000,
    referenceTime: tripStart,
    minimumGap: 2,
  }),

  /**
   * Convert predicted at-sea duration to absolute arrival timestamp
   *
   * @param durationMinutes - Predicted time spent at sea
   * @param leftDock - When vessel left the departure dock
   * @returns Time conversion parameters for validation
   */
  atSeaToArrival: (durationMinutes: number, leftDock: number) => ({
    absoluteTime: leftDock + durationMinutes * 60000,
    referenceTime: leftDock,
    minimumGap: 2,
  }),
};
