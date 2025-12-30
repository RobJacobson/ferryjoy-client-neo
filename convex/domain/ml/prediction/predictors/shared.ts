// ============================================================================
// PREDICTION UTILITIES
// Core prediction functions and feature extractors
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ModelType } from "../../shared/core/modelTypes";
import { extractFeatures } from "../../shared/features/extractFeatures";
import { loadModel } from "../../training/models/loadModel";
import { applyLinearRegression } from "../predictLinearRegression";
import type { PredictionResult } from "./types";

/**
 * Make a machine learning prediction for ferry schedule timing
 *
 * This function orchestrates the complete prediction pipeline:
 * 1. Extract terminal abbreviations from features
 * 2. Load the appropriate trained model for the terminal pair
 * 3. Extract and normalize features from input parameters
 * 4. Apply linear regression to get duration prediction
 * 5. Convert duration to absolute timestamp with validation
 * 6. Return prediction result with confidence metrics
 *
 * @param ctx - Convex context for database operations
 * @param modelType - Type of prediction model to use
 * @param features - Raw feature parameters for prediction (must contain DepartingTerminalAbbrev and ArrivingTerminalAbbrev)
 * @param baseTime - The reference time for this prediction (scheduled departure, trip start, or left dock)
 * @param minimumGap - Minimum duration in minutes from baseTime to absoluteTime (default: 2)
 * @returns Promise resolving to prediction result with timestamp and accuracy metrics
 * @throws Error if model not found or prediction fails
 */
export const makePrediction = async (
  ctx: ActionCtx | MutationCtx,
  modelType: ModelType,
  features: Record<string, unknown>,
  baseTime: number
): Promise<PredictionResult> => {
  // Extract terminal abbreviations from features
  const departingTerminal = features.DepartingTerminalAbbrev as string;
  const arrivingTerminal = features.ArrivingTerminalAbbrev as string;

  // Construct terminal pair key for arriveBeforeFeatures calculation
  // This is required for models that extract arrival timing features
  const terminalPairKey = `${departingTerminal}->${arrivingTerminal}`;

  // Add terminalPairKey to features for models that need it
  const featuresWithKey = {
    ...features,
    terminalPairKey,
  };

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
  let featureRecord: Record<string, number>;
  try {
    featureRecord = extractFeatures(modelType, featuresWithKey);
  } catch (error) {
    throw new Error(`Feature extraction failed: ${error}`);
  }

  // Apply linear regression with trained coefficients and intercept
  const predictedTime = baseTime + applyLinearRegression(model, featureRecord);

  return {
    predictedTime: Math.round(predictedTime * 10) / 10,
    mae: Math.round(model.trainingMetrics.mae * 10) / 10,
  };
};
