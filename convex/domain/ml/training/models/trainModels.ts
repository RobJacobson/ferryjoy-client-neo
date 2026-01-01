// ============================================================================
// MODEL TRAINING
// Consolidated training logic from step_5_trainBuckets.ts
// ============================================================================

import type {
  ModelParameters,
  TerminalPairBucket,
  TrainingExample,
} from "domain/ml/shared/core/types";
import MLR from "ml-regression-multivariate-linear";
import type { Features } from "../../shared/features";
import { type ModelType, models } from "../../shared/models";
import { predictWithModel } from "../../shared/prediction/applyModel";
import {
  calculateMAE,
  calculateR2,
  calculateRMSE,
} from "../../shared/prediction/metrics";

/**
 * Create training examples for a specific model type from processed features
 *
 * Converts Features objects into TrainingExample format by:
 * 1. Extracting features using model-specific logic
 * 2. Calculating target values using central model definitions
 *
 * @param features - Array of processed features for this terminal pair
 * @param modelType - Type of model to create examples for
 * @returns Array of training examples with input features and target values
 */
const createTrainingExamples = (
  features: Features[],
  modelType: ModelType
): TrainingExample[] => {
  const modelDefinition = models[modelType];

  return features.map((featureSet) => {
    // Extract features using model-specific logic (ensures consistency)
    const extractedFeatures = modelDefinition.extractFeatures(featureSet);

    // Calculate target value using central model definition
    const target = modelDefinition.calculateTarget(featureSet);

    return {
      input: extractedFeatures,
      target,
    };
  });
};

/**
 * Train a single linear regression model for a terminal pair and model type
 *
 * This function creates training examples, trains a multivariate linear regression model,
 * and returns the trained model parameters with performance metrics.
 *
 * @param bucket - Terminal pair bucket containing training records
 * @param modelType - Type of prediction model to train
 * @returns Trained model parameters with coefficients, intercept, and metrics
 * @throws Error if no training examples available or training fails
 */
export const trainModel = (
  bucket: TerminalPairBucket,
  modelType: ModelType
): ModelParameters => {
  const examples = createTrainingExamples(bucket.features, modelType);

  if (examples.length === 0) {
    throw new Error(`No training examples for ${modelType}`);
  }

  // Extract feature matrix X and target vector y
  const X = examples.map((ex) => Object.values(ex.input) as number[]);
  const y = examples.map((ex) => ex.target);

  // Train multivariate linear regression model
  // MLR library expects y as 2D array (n_samples x 1)
  const y2d = y.map((val) => [val]);
  const mlr = new MLR(X, y2d);

  // Extract model weights: coefficients for each feature plus intercept
  // MLR returns weights as 2D array: [coefficients..., intercept]
  const weights = mlr.weights as number[][];
  const coefficients = weights
    .slice(0, -1) // All but last element are feature coefficients
    .map((row) => roundTinyValues(row[0]));
  const intercept = roundTinyValues(
    weights[weights.length - 1][0] // Last element is intercept
  );

  // Calculate predictions and metrics
  const predictions = X.map((row) =>
    predictWithModel(row, coefficients, intercept)
  );

  return {
    departingTerminalAbbrev: bucket.terminalPair.departingTerminalAbbrev,
    arrivingTerminalAbbrev: bucket.terminalPair.arrivingTerminalAbbrev,
    modelType,
    coefficients,
    intercept,
    trainingMetrics: {
      mae: calculateMAE(y, predictions),
      rmse: calculateRMSE(y, predictions),
      r2: calculateR2(y, predictions),
    },
    createdAt: Date.now(),
    bucketStats: bucket.bucketStats,
  };
};

const roundTinyValues = (value: number): number =>
  Math.round(value * 100000) / 100000;
