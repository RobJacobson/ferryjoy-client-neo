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
import type { FeatureExtractionParams } from "../../shared/features/extractFeatures";
import { roundTinyValues } from "../../shared/features/timeFeatures";

/**
 * Create training examples for a specific model type from raw training records
 *
 * Converts TrainingDataRecord objects into TrainingExample format by:
 * 1. Transforming records into unified parameter format
 * 2. Extracting features using the same logic as prediction
 * 3. Determining target values based on model type
 *
 * @param records - Array of training data records for this terminal pair
 * @param modelType - Type of model to create examples for
 * @returns Array of training examples with input features and target values
 */
const createTrainingExamples = (
  records: TrainingDataRecord[],
  modelType: ModelType
): TrainingExample[] => {
  const { extractFeatures } = require("../../shared/features/extractFeatures");

  /**
   * Type-safe mapping from TrainingDataRecord to FeatureExtractionParams
   * This function ensures field names match exactly what extractors expect.
   * If TrainingDataRecord or FeatureExtractionParams field names change,
   * TypeScript will catch the mismatch at compile time.
   *
   * Maps TrainingDataRecord (PascalCase) → FeatureExtractionParams (PascalCase) → FeatureRecord (camelCase)
   */
  const mapToFeatureParams = (
    record: TrainingDataRecord
  ): FeatureExtractionParams => ({
    ScheduledDeparture: record.ScheduledDeparture,
    PrevTripDelay: record.PrevTripDelay,
    PrevAtSeaDuration: record.PrevAtSeaDuration,
    AtDockDuration: record.AtDockDuration,
    TripDelay: record.TripDelay,
    arriveBeforeMinutes: record.arriveBeforeMinutes,
  });

  return records.map((record) => {
    // Type-safe conversion ensures field names match extractor expectations
    const params = mapToFeatureParams(record);

    // Extract features using same logic as prediction (ensures consistency)
    const features = extractFeatures(modelType, params);

    // Determine target value based on model type (what we're trying to predict)
    let target: number;
    switch (modelType) {
      case MODEL_TYPES.ARRIVE_DEPART_ATDOCK_DURATION:
        target = record.AtDockDuration; // How long vessel stays at dock
        break;
      case MODEL_TYPES.DEPART_ARRIVE_ATSEA_DURATION:
        target = record.AtSeaDuration; // How long vessel spends at sea
        break;
      case MODEL_TYPES.ARRIVE_ARRIVE_TOTAL_DURATION:
        target = record.AtDockDuration + record.AtSeaDuration; // Total trip time
        break;
      case MODEL_TYPES.ARRIVE_DEPART_DELAY:
        target = record.TripDelay; // Departure delay in minutes
        break;
      case MODEL_TYPES.DEPART_DEPART_TOTAL_DURATION:
        // Time between consecutive departures (simplified)
        target = record.PrevAtSeaDuration + record.AtDockDuration;
        break;
      default:
        throw new Error(`Unknown model type: ${modelType}`);
    }

    return {
      input: features,
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
  const examples = createTrainingExamples(bucket.records, modelType);

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
    .map((row) =>
      roundTinyValues(
        row[0],
        PIPELINE_CONFIG.COEFFICIENT_ROUNDING_ZERO_THRESHOLD
      )
    );
  const intercept = roundTinyValues(
    weights[weights.length - 1][0], // Last element is intercept
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
 * Calculate Mean Absolute Error (MAE) - average absolute prediction error
 *
 * MAE measures the average magnitude of prediction errors without considering direction.
 * Lower values indicate better model performance. Measured in the same units as targets.
 *
 * @param actual - Array of actual target values
 * @param predicted - Array of predicted values from the model
 * @returns Mean absolute error
 */
const calculateMAE = (actual: number[], predicted: number[]): number => {
  return (
    actual.reduce((sum, act, i) => sum + Math.abs(act - predicted[i]), 0) /
    actual.length
  );
};

/**
 * Calculate Root Mean Squared Error (RMSE) - square root of average squared errors
 *
 * RMSE gives higher weight to larger errors compared to MAE. It's in the same units
 * as the target variable and provides a measure of prediction accuracy.
 *
 * @param actual - Array of actual target values
 * @param predicted - Array of predicted values from the model
 * @returns Root mean squared error
 */
const calculateRMSE = (actual: number[], predicted: number[]): number => {
  const mse =
    actual.reduce((sum, act, i) => sum + (act - predicted[i]) ** 2, 0) /
    actual.length;
  return Math.sqrt(mse);
};

/**
 * Calculate R² (coefficient of determination) - proportion of variance explained
 *
 * R² measures how well the model explains the variability in the target.
 * Values range from 0 to 1, where 1 indicates perfect predictions and 0 indicates
 * the model performs no better than predicting the mean.
 *
 * @param actual - Array of actual target values
 * @param predicted - Array of predicted values from the model
 * @returns R-squared value between 0 and 1
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
 * Make a prediction using trained linear regression model parameters
 *
 * Applies the linear regression equation: y = intercept + Σ(coefficient_i × feature_i)
 *
 * @param features - Array of feature values in same order as training
 * @param coefficients - Trained coefficients for each feature
 * @param intercept - Trained intercept (bias) term
 * @returns Predicted target value
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
