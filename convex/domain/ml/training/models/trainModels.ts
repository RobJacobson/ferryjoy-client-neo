// ============================================================================
// ML - MODEL TRAINING (linear regression)
// ============================================================================

import MLR from "ml-regression-multivariate-linear";
import { roundToPrecision } from "shared/durationUtils";
import { predictWithModel } from "../../prediction/applyModel";
import {
  calculateMAE,
  calculateR2,
  calculateRMSE,
  calculateStdDevErrors,
} from "../../prediction/metrics";
import { models } from "../../shared/models";
import type {
  ModelParameters,
  ModelType,
  TrainingBucket,
  TrainingExample,
} from "../../shared/types";

const getMean = (values: number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

const roundTinyValues = (value: number): number => roundToPrecision(value, 6);

const createTrainingExamples = (
  records: TrainingBucket["records"],
  modelType: ModelType
): TrainingExample[] => {
  const modelDefinition = models[modelType];

  const examples: TrainingExample[] = [];
  for (const record of records) {
    const target = modelDefinition.calculateTarget(record);
    if (target === null) {
      continue;
    }

    examples.push({
      input: modelDefinition.extractFeatures(record),
      target,
    });
  }

  return examples;
};

/**
 * Train a linear regression model for a specific route and prediction type.
 *
 * Uses chronological train/test split to simulate real-world prediction scenarios
 * where we predict future behavior using past data.
 *
 * @param bucket - Training data for a specific terminal route
 * @param modelType - Type of prediction model to train
 * @returns Trained model parameters or null if insufficient data
 */
export const trainModel = (
  bucket: TrainingBucket,
  modelType: ModelType
): ModelParameters | null => {
  // Chronological split: train on earlier data, test on more recent data
  // This simulates real prediction scenarios (past data → future predictions)
  const splitIndex = Math.floor(bucket.records.length * 0.8);
  const trainRecords = bucket.records.slice(0, splitIndex);
  const testRecords = bucket.records.slice(splitIndex);

  // Require minimum data for statistically meaningful training
  const minExamples = 20;
  if (
    bucket.records.length < minExamples ||
    trainRecords.length < 10 ||
    testRecords.length < 5
  ) {
    return null; // Insufficient data for this route+model combination
  }

  // Convert training windows to ML examples (features → target)
  const trainExamples = createTrainingExamples(trainRecords, modelType);
  const testExamples = createTrainingExamples(testRecords, modelType);

  // Some model types (depart-next) require multi-leg context and may have fewer valid examples
  if (trainExamples.length < 10 || testExamples.length < 5) {
    return null; // Not enough valid examples after filtering
  }

  // Ensure consistent feature ordering across training and inference
  const featureKeys = Object.keys(trainExamples[0].input).sort();

  // Convert feature objects to arrays in consistent order
  const toRow = (input: Record<string, number>): number[] =>
    featureKeys.map((k) => input[k] ?? 0);

  // Prepare training data matrices
  const X_train = trainExamples.map((ex) => toRow(ex.input)); // Feature matrix
  const y_train = trainExamples.map((ex) => ex.target); // Target vector

  // Prepare test data for evaluation
  const X_test = testExamples.map((ex) => toRow(ex.input));
  const y_test = testExamples.map((ex) => ex.target);

  // Train linear regression model (library expects 2D target array)
  const y_train_2d = y_train.map((val) => [val]);
  const mlr = new MLR(X_train, y_train_2d);

  // Extract trained weights (coefficients + intercept)
  const weights = mlr.weights as number[][];
  if (!Array.isArray(weights) || weights.length === 0) {
    return null; // Training failed
  }

  // Extract coefficients (all weights except the last, which is intercept)
  const coefficients = weights
    .slice(0, -1) // All but last element
    .map((row) =>
      Array.isArray(row) && row.length === 1 ? roundTinyValues(row[0]) : 0
    );

  // Extract intercept (bias term)
  const intercept =
    Array.isArray(weights[weights.length - 1]) &&
    weights[weights.length - 1].length === 1
      ? roundTinyValues(weights[weights.length - 1][0])
      : 0;

  // Check for numerical instability (exploding coefficients, NaN values)
  const maxCoeff = Math.max(...coefficients.map(Math.abs));
  const isUnstable =
    maxCoeff > 10000 || // Coefficients too large (overfitting indicator)
    !Number.isFinite(intercept) || // Invalid intercept
    coefficients.some((c) => !Number.isFinite(c)); // Invalid coefficients

  // Fallback to mean prediction if model is unstable
  const finalIntercept = isUnstable ? getMean(y_train) : intercept;
  const finalCoefficients = isUnstable
    ? coefficients.map(() => 0) // Zero out all coefficients
    : coefficients;

  // Generate predictions on test set for evaluation
  const testPredictions = isUnstable
    ? y_test.map(() => finalIntercept) // Predict mean for all if unstable
    : X_test.map((row) =>
        predictWithModel(row, finalCoefficients, finalIntercept)
      );

  // Return trained model with performance metrics
  return {
    modelType,
    bucketKey: bucket.bucketKey,
    featureKeys,
    coefficients: finalCoefficients,
    intercept: finalIntercept,
    testMetrics: {
      mae: calculateMAE(y_test, testPredictions),
      rmse: calculateRMSE(y_test, testPredictions),
      r2: calculateR2(y_test, testPredictions),
      stdDev: calculateStdDevErrors(y_test, testPredictions),
    },
    createdAt: Date.now(),
    bucketStats: bucket.bucketStats,
  };
};
