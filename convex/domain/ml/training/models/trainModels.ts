// ============================================================================
// MODEL TRAINING
// Consolidated training logic from step_5_trainBuckets.ts
// ============================================================================

import MLR from "ml-regression-multivariate-linear";
import { PIPELINE_CONFIG } from "../../shared/core/config";
import type { ModelType } from "../../shared/core/modelTypes";
import { MODEL_TYPES } from "../../shared/core/modelTypes";
import type {
  ModelParameters,
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingExample,
} from "../../shared/core/types";
import { roundTinyValues } from "../../shared/features/timeFeatures";

/**
 * Create training examples for a specific model type
 */
const createTrainingExamples = (
  records: TrainingDataRecord[],
  modelType: string
): TrainingExample[] => {
  // Import here to avoid circular dependencies
  const {
    extractArriveDepartAtDockFeatures,
    extractDepartArriveAtSeaFeatures,
    extractArriveArriveTotalFeatures,
    extractArriveDepartDelayFeatures,
  } = require("../../shared/features/extractFeatures");

  return records.map((record) => {
    let features: Record<string, number>;

    switch (modelType) {
      case MODEL_TYPES.ARRIVE_DEPART_ATDOCK_DURATION:
        features = extractArriveDepartAtDockFeatures(record);
        return { input: features, target: record.currAtDockDuration };

      case MODEL_TYPES.DEPART_ARRIVE_ATSEA_DURATION:
        features = extractDepartArriveAtSeaFeatures(
          record.schedDepartureTimestamp,
          record.currAtDockDuration,
          record.currDelay
        );
        return { input: features, target: record.currAtSeaDuration };

      case MODEL_TYPES.ARRIVE_ARRIVE_TOTAL_DURATION:
        features = extractArriveArriveTotalFeatures(record);
        return {
          input: features,
          target: record.currAtDockDuration + record.currAtSeaDuration,
        };

      case MODEL_TYPES.ARRIVE_DEPART_DELAY:
        features = extractArriveDepartDelayFeatures(record);
        return { input: features, target: record.currDelay };

      default:
        throw new Error(`Unknown model type: ${modelType}`);
    }
  });
};

/**
 * Train a single model for a terminal pair and model type
 */
export const trainModel = (
  bucket: TerminalPairBucket,
  modelType: ModelType
): ModelParameters => {
  const examples = createTrainingExamples(bucket.records, modelType);

  if (examples.length === 0) {
    throw new Error(`No training examples for ${modelType}`);
  }

  // Extract features and targets
  const X = examples.map((ex) => Object.values(ex.input) as number[]);
  const y = examples.map((ex) => ex.target);

  // Train linear regression model (MLR expects y as 2D array)
  const y2d = y.map((val) => [val]);
  const mlr = new MLR(X, y2d);

  // Extract coefficients and intercept from weights (MLR returns 2D array)
  const weights = mlr.weights as number[][];
  const coefficients = weights
    .slice(0, -1)
    .map((row) =>
      roundTinyValues(
        row[0],
        PIPELINE_CONFIG.COEFFICIENT_ROUNDING_ZERO_THRESHOLD
      )
    );
  const intercept = roundTinyValues(
    weights[weights.length - 1][0],
    PIPELINE_CONFIG.COEFFICIENT_ROUNDING_ZERO_THRESHOLD
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

/**
 * Calculate Mean Absolute Error
 */
const calculateMAE = (actual: number[], predicted: number[]): number => {
  return (
    actual.reduce((sum, act, i) => sum + Math.abs(act - predicted[i]), 0) /
    actual.length
  );
};

/**
 * Calculate Root Mean Squared Error
 */
const calculateRMSE = (actual: number[], predicted: number[]): number => {
  const mse =
    actual.reduce((sum, act, i) => sum + (act - predicted[i]) ** 2, 0) /
    actual.length;
  return Math.sqrt(mse);
};

/**
 * Calculate R² (coefficient of determination)
 */
const calculateR2 = (actual: number[], predicted: number[]): number => {
  const n = actual.length;
  if (n === 0) return 0;

  const yMean = actual.reduce((sum, val) => sum + val, 0) / n;
  const ssRes = actual.reduce(
    (sum, act, i) => sum + (act - predicted[i]) ** 2,
    0
  );
  const ssTot = actual.reduce((sum, act) => sum + (act - yMean) ** 2, 0);

  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
};

/**
 * Make prediction with model coefficients
 */
const predictWithModel = (
  features: number[],
  coefficients: number[],
  intercept: number
): number => {
  return (
    intercept +
    features.reduce((sum, feat, i) => sum + feat * (coefficients[i] || 0), 0)
  );
};
