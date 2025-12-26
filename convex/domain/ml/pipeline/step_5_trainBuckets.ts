// ============================================================================
// STEP 5: TRAIN BUCKET MODELS
// Model training for terminal pair buckets (includes training, metrics, and holdout evaluation)
// ============================================================================

import MLR from "ml-regression-multivariate-linear";
import type {
  ModelParameters,
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingExample,
} from "../types";
import { formatTerminalPairKey, PIPELINE_CONFIG } from "./shared/config";
import { createTrainingDataForBucketSingle } from "./step_4_createTrainingData";

// ============================================================================
// ALGORITHM CONSTANTS
// ============================================================================

export const ALGORITHM_NAME = "multivariate-linear-regression";

// ============================================================================
// METRICS TYPES AND FUNCTIONS
// ============================================================================

/**
 * Model performance metrics
 */
type ModelMetrics = {
  mae: number;
  rmse: number;
  r2: number;
};

/**
 * Calculate model performance metrics (MAE, RMSE, R²)
 */
const calculateMetrics = (
  actuals: number[],
  predictions: number[]
): ModelMetrics => {
  const n = actuals.length;
  if (n === 0) {
    throw new Error("Cannot calculate metrics: no data");
  }

  // Mean Absolute Error
  const mae =
    actuals.reduce(
      (sum, actual, i) => sum + Math.abs(actual - predictions[i]),
      0
    ) / n;

  // Root Mean Squared Error
  const ssRes = actuals.reduce(
    (sum, actual, i) => sum + (actual - predictions[i]) ** 2,
    0
  );
  const rmse = Math.sqrt(ssRes / n);

  // R² (coefficient of determination)
  const yMean = actuals.reduce((sum, val) => sum + val, 0) / n;
  const ssTot = actuals.reduce((sum, actual) => sum + (actual - yMean) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { mae, rmse, r2 };
};

// ============================================================================
// MODEL TRAINING FUNCTIONS
// ============================================================================

/**
 * Result from training a model
 * Linear regression models always have coefficients and intercept set
 */
type TrainingResult = {
  // For linear models: always set when examples > 0
  coefficients: number[];
  intercept: number;

  // Prediction function for this model
  predict: (features: number[]) => number;
};

const roundTinyCoefficient = (value: number): number => {
  // Values this small contribute essentially nothing to minute-level predictions.
  return Math.abs(value) < PIPELINE_CONFIG.COEFFICIENT_ROUNDING_ZERO_THRESHOLD
    ? 0
    : value;
};

/**
 * Linear Regression trainer using MLR
 */
const trainLinearRegression = (examples: TrainingExample[]): TrainingResult => {
  const x = examples.map((ex) => Object.values(ex.input) as number[]);
  const y = examples.map((ex) => ex.target);

  const y2d = y.map((val) => [val]);
  const regression = new MLR(x, y2d);

  const coefficients = regression.weights
    .slice(0, -1)
    .map((row) => roundTinyCoefficient(row[0]));
  const intercept = roundTinyCoefficient(
    regression.weights[regression.weights.length - 1][0]
  );

  return {
    coefficients,
    intercept,
    predict: (features: number[]) => {
      let prediction = intercept;
      for (let i = 0; i < features.length; i++) {
        prediction += coefficients[i] * features[i];
      }
      return prediction;
    },
  };
};

// ============================================================================
// HOLDOUT EVALUATION FUNCTIONS
// ============================================================================

/**
 * Result from holdout evaluation
 */
type HoldoutEvaluationResult = {
  strategy: "time_split" | "insufficient_data";
  foldsUsed: number;
  metrics: ModelMetrics;
};

/**
 * Create training examples directly from records (memory-efficient, avoids bucket creation)
 * Uses the same feature extraction logic as step_4 for consistency
 */
const createExamplesFromRecords = (
  records: TrainingDataRecord[],
  modelType:
    | "arrive-depart"
    | "depart-arrive"
    | "arrive-arrive"
    | "depart-depart"
    | "arrive-depart-late"
): TrainingExample[] => {
  // Create a temporary bucket to reuse step 4 functions
  // This ensures consistency with the main training path
  const tempBucket: TerminalPairBucket = {
    terminalPair: { departingTerminalAbbrev: "", arrivingTerminalAbbrev: "" },
    bucketStats: { totalRecords: records.length, filteredRecords: records.length },
    records,
  };
  return createTrainingDataForBucketSingle(tempBucket, modelType);
};

/**
 * Compute holdout metrics using a single chronological 80/20 split.
 * Memory-optimized version that avoids creating intermediate buckets.
 *
 * @param sortedRecords - Pre-sorted training records (chronological by scheduled departure)
 * @param modelType - Model type to evaluate
 * @returns Holdout evaluation result with metrics
 */
const computeHoldoutMetrics = async (
  sortedRecords: TrainingDataRecord[],
  modelType:
    | "arrive-depart"
    | "depart-arrive"
    | "arrive-arrive"
    | "depart-depart"
    | "arrive-depart-late"
): Promise<HoldoutEvaluationResult> => {
  const EVAL_CONFIG = PIPELINE_CONFIG.EVALUATION;

  if (!EVAL_CONFIG.enabled) {
    return {
      strategy: "insufficient_data",
      foldsUsed: 0,
      metrics: { mae: 0, rmse: 0, r2: 0 },
    };
  }

  // 80/20 split: train on first 80%, test on last 20%
  const splitIdx = Math.floor(sortedRecords.length * EVAL_CONFIG.trainRatio);
  const trainRecords = sortedRecords.slice(0, splitIdx);
  const testRecords = sortedRecords.slice(splitIdx);

  if (trainRecords.length === 0 || testRecords.length === 0) {
    return {
      strategy: "insufficient_data",
      foldsUsed: 0,
      metrics: { mae: 0, rmse: 0, r2: 0 },
    };
  }

  // Create training examples directly from records (avoid creating buckets)
  const trainExamples = createExamplesFromRecords(trainRecords, modelType);
  const testExamples = createExamplesFromRecords(testRecords, modelType);

  if (trainExamples.length === 0 || testExamples.length === 0) {
    return {
      strategy: "insufficient_data",
      foldsUsed: 0,
      metrics: { mae: 0, rmse: 0, r2: 0 },
    };
  }

  // Train model on training set
  const trainingResult = trainLinearRegression(trainExamples);

  // Evaluate on test set (process in place to minimize memory)
  const testX = testExamples.map((ex) => Object.values(ex.input) as number[]);
  const testY = testExamples.map((ex) => ex.target);
  const predictions = testX.map((features) => trainingResult.predict(features));
  const metrics = calculateMetrics(testY, predictions);

  return {
    strategy: "time_split",
    foldsUsed: 1,
    metrics,
  };
};

// ============================================================================
// MAIN TRAINING FUNCTIONS
// ============================================================================

/**
 * Train models for a single bucket
 * Processes one model at a time to reduce memory pressure
 */
export const trainModelsForBucket = async (
  bucket: TerminalPairBucket
): Promise<ModelParameters[]> => {
  const results: ModelParameters[] = [];
  const pairKey = formatTerminalPairKey(
    bucket.terminalPair.departingTerminalAbbrev,
    bucket.terminalPair.arrivingTerminalAbbrev
  );

  console.log(
    `Training models for ${pairKey} (${bucket.records.length} records)`
  );

  // Sort records once for all models (used by holdout evaluation)
  // Sort in place to avoid creating a copy
  const sortedRecords = bucket.records
    .slice()
    .sort((a, b) => a.schedDepartureTimestamp - b.schedDepartureTimestamp);

  // Define model types to train
  const modelTypes: Array<
    "arrive-depart" | "depart-arrive" | "arrive-arrive" | "depart-depart" | "arrive-depart-late"
  > = ["arrive-depart", "depart-arrive", "arrive-arrive", "depart-depart", "arrive-depart-late"];

  // Process one model at a time to reduce memory pressure
  for (const modelType of modelTypes) {
    // Create training data for this model only
    const examples = createTrainingDataForBucketSingle(bucket, modelType);

    // Train this model (pass sorted records for holdout evaluation)
    const model = await trainSingleModel(
      examples,
      modelType,
      bucket,
      sortedRecords
    );
    results.push(model);

    // Training data for this model is now out of scope and can be garbage collected
  }

  return results;
};

/**
 * Train a single model for given examples
 */
const trainSingleModel = async (
  examples: TrainingExample[],
  modelType:
    | "arrive-depart"
    | "depart-arrive"
    | "arrive-arrive"
    | "depart-depart"
    | "arrive-depart-late",
  bucket: TerminalPairBucket,
  sortedRecords: TrainingDataRecord[]
): Promise<ModelParameters> => {
  const pairKey = formatTerminalPairKey(
    bucket.terminalPair.departingTerminalAbbrev,
    bucket.terminalPair.arrivingTerminalAbbrev
  );

  // Compute holdout evaluation metrics (if enabled)
  // Pass pre-sorted records to avoid creating multiple copies
  const holdoutResult = await computeHoldoutMetrics(sortedRecords, modelType);

  // Train model on all available data
  const trainingResult = trainLinearRegression(examples);

  // Calculate essential metrics (MAE, RMSE, R²)
  // Use holdout metrics if available, otherwise calculate in-sample metrics
  let mae: number;
  let rmse: number;
  let r2: number;

  if (holdoutResult.strategy === "time_split") {
    // Use holdout metrics (already computed, no need to recalculate)
    ({ mae, rmse, r2 } = holdoutResult.metrics);
  } else {
    // Calculate in-sample metrics (only if holdout evaluation failed)
    const x = examples.map((ex) => Object.values(ex.input) as number[]);
    const y = examples.map((ex) => ex.target);
    const predictions = x.map((features) => trainingResult.predict(features));
    ({ mae, rmse, r2 } = calculateMetrics(y, predictions));
  }

  const model: ModelParameters = {
    departingTerminalAbbrev: bucket.terminalPair.departingTerminalAbbrev,
    arrivingTerminalAbbrev: bucket.terminalPair.arrivingTerminalAbbrev,
    modelType,
    coefficients: trainingResult.coefficients,
    intercept: trainingResult.intercept,
    trainingMetrics: {
      mae,
      rmse,
      r2,
    },
    createdAt: Date.now(),
    bucketStats: {
      totalRecords: bucket.bucketStats.totalRecords,
      filteredRecords: bucket.bucketStats.filteredRecords,
      meanDepartureDelay: bucket.bucketStats.meanDepartureDelay,
      meanAtSeaDuration: bucket.bucketStats.meanAtSeaDuration,
      meanDelay: bucket.bucketStats.meanDelay,
    },
    // Include evaluation result if available
    evaluation:
      holdoutResult.strategy === "time_split"
        ? {
            strategy: holdoutResult.strategy,
            foldsUsed: holdoutResult.foldsUsed,
            holdout: holdoutResult.metrics,
          }
        : undefined,
  };

  console.log(
    `Trained ${modelType} model (${ALGORITHM_NAME}) for ${pairKey}: ${examples.length} examples, MAE=${mae.toFixed(2)}, R²=${r2.toFixed(3)}`
  );

  return model;
};
