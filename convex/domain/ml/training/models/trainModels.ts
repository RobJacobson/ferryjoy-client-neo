// ============================================================================
// MODEL TRAINING
// Consolidated training logic from step_5_trainBuckets.ts
// ============================================================================

import type {
  ModelParameters,
  TerminalPairBucket,
  TrainingExample,
} from "domain/ml/shared/types";
import MLR from "ml-regression-multivariate-linear";
import { roundToPrecision } from "shared/durationUtils";
import { predictWithModel } from "../../prediction/applyModel";
import {
  calculateMAE,
  calculateR2,
  calculateRMSE,
} from "../../prediction/metrics";
import type { Features } from "../../shared/features";
import { type ModelType, models } from "../../shared/models";

const getMean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

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
 * This function implements an 80/20 train-test split:
 * - Trains on the first 80% of examples (chronologically ordered)
 * - Evaluates performance on the remaining 20% test set
 * - Returns model parameters with test set performance metrics
 *
 * @param bucket - Terminal pair bucket containing training records
 * @param modelType - Type of prediction model to train
 * @returns Trained model parameters with coefficients, intercept, and test metrics
 * @throws Error if no training examples available or training fails
 */
export const trainModel = (
  bucket: TerminalPairBucket,
  modelType: ModelType
): ModelParameters => {
  // 80/20 train-test split on features (maintains chronological order)
  const splitIndex = Math.floor(bucket.features.length * 0.8);
  const trainFeatures = bucket.features.slice(0, splitIndex);
  const testFeatures = bucket.features.slice(splitIndex);

  // Require minimum examples for meaningful training and evaluation
  const minExamples = 10; // Minimum total examples for train-test split
  if (
    bucket.features.length < minExamples ||
    trainFeatures.length < 5 ||
    testFeatures.length < 2
  ) {
    console.log(
      `Skipping ${modelType} for ${bucket.terminalPair.departingTerminalAbbrev}->${bucket.terminalPair.arrivingTerminalAbbrev}: insufficient data (${bucket.features.length} total, ${trainFeatures.length} train, ${testFeatures.length} test)`
    );
    throw new Error(
      `Insufficient data for ${modelType}: ${bucket.features.length} total, ${trainFeatures.length} train, ${testFeatures.length} test`
    );
  }

  const trainExamples = createTrainingExamples(trainFeatures, modelType);
  const testExamples = createTrainingExamples(testFeatures, modelType);

  console.log(
    `Training ${modelType} for ${bucket.terminalPair.departingTerminalAbbrev}->${bucket.terminalPair.arrivingTerminalAbbrev}: ${trainExamples.length} train, ${testExamples.length} test examples`
  );

  if (trainExamples.length === 0) {
    throw new Error(`No training examples after split for ${modelType}`);
  }

  // Extract training data
  const X_train = trainExamples.map(
    (ex) => Object.values(ex.input) as number[]
  );
  const y_train = trainExamples.map((ex) => ex.target);

  // Extract test data for evaluation
  const X_test = testExamples.map((ex) => Object.values(ex.input) as number[]);
  const y_test = testExamples.map((ex) => ex.target);

  // Train multivariate linear regression model on training set
  // MLR library expects y as 2D array (n_samples x 1)
  const y_train_2d = y_train.map((val) => [val]);
  const mlr = new MLR(X_train, y_train_2d);

  // Extract model weights: coefficients for each feature plus intercept
  // MLR returns weights as 2D array: [coefficients..., intercept]
  const weights = mlr.weights as number[][];

  // SAFEGUARD: Validate weights structure before extraction
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new Error(
      `Invalid MLR weights structure: ${JSON.stringify(weights)}`
    );
  }

  // Check if weights are in expected format [coefficient] arrays
  const expectedLength = (X_train[0]?.length || 0) + 1; // +1 for intercept
  if (weights.length !== expectedLength) {
    // Keep going (we'll fall back to baseline below if this causes instability).
  }

  // Check if all weights are [number] arrays
  const invalidWeights = weights.filter(
    (w) => !Array.isArray(w) || w.length !== 1 || typeof w[0] !== "number"
  );

  const coefficients = weights
    .slice(0, -1) // All but last element are feature coefficients
    .map((row, i) => {
      if (!Array.isArray(row) || row.length !== 1) {
        console.error(`Invalid coefficient structure at index ${i}:`, row);
        return 0; // fallback
      }
      return roundTinyValues(row[0]);
    });
  const intercept =
    Array.isArray(weights[weights.length - 1]) &&
    weights[weights.length - 1].length === 1
      ? roundTinyValues(weights[weights.length - 1][0])
      : 0; // fallback

  // FINAL VALIDATION: Check for abnormally large coefficients
  const maxCoeff = Math.max(...coefficients.map(Math.abs));
  const isUnstable =
    maxCoeff > 10000 ||
    !Number.isFinite(intercept) ||
    coefficients.some((c) => !Number.isFinite(c)) ||
    invalidWeights.length > 0;

  // Calculate predictions on test set and metrics
  const rawTestPredictions = X_test.map((row) =>
    predictWithModel(row, coefficients, intercept)
  );

  // If training is numerically unstable, fall back to baseline predictor
  // This prevents "bizarre outliers" from poisoning aggregate training stats
  const finalIntercept = isUnstable ? getMean(y_train) : intercept;
  const finalCoefficients = isUnstable
    ? coefficients.map(() => 0)
    : coefficients;

  // Use baseline predictions for unstable models, otherwise use trained model predictions
  const testPredictions = isUnstable
    ? y_test.map(() => finalIntercept)
    : rawTestPredictions;

  return {
    departingTerminalAbbrev: bucket.terminalPair.departingTerminalAbbrev,
    arrivingTerminalAbbrev: bucket.terminalPair.arrivingTerminalAbbrev,
    modelType,
    coefficients: finalCoefficients,
    intercept: finalIntercept,
    testMetrics: {
      mae: calculateMAE(y_test, testPredictions),
      rmse: calculateRMSE(y_test, testPredictions),
      r2: calculateR2(y_test, testPredictions),
    },
    createdAt: Date.now(),
    bucketStats: bucket.bucketStats,
  };
};

const roundTinyValues = (value: number): number => roundToPrecision(value, 6);
