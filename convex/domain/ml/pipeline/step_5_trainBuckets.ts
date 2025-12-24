// ============================================================================
// STEP 5: TRAIN BUCKET MODELS
// Model training for terminal pair buckets (includes training, metrics, and holdout evaluation)
// ============================================================================

import MLR from "ml-regression-multivariate-linear";
import { createTrainingDataForBucketBoth } from "./step_4_createTrainingData";
import { PIPELINE_CONFIG } from "./shared/config";
import type {
  FeatureRecord,
  ModelParameters,
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingExample,
} from "../types";

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
 */
type TrainingResult = {
  // For linear models: coefficients and intercept
  coefficients?: number[];
  intercept?: number;

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
const trainLinearRegression = (
  examples: TrainingExample[]
): TrainingResult => {
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
 * Compute holdout metrics using a single chronological 80/20 split.
 * This better reflects final model's performance since it's also trained on all data.
 * The evaluation trains on 80% of data (earliest) and tests on 20% (most recent).
 *
 * @param records - Training records to split
 * @param modelType - "departure" or "arrival"
 * @returns Holdout evaluation result with metrics
 */
const computeHoldoutMetrics = async (
  records: TrainingDataRecord[],
  modelType: "departure" | "arrival"
): Promise<HoldoutEvaluationResult> => {
  const EVAL_CONFIG = PIPELINE_CONFIG.EVALUATION;

  if (!EVAL_CONFIG.enabled) {
    return {
      strategy: "insufficient_data",
      foldsUsed: 0,
      metrics: { mae: 0, rmse: 0, r2: 0 },
    };
  }

  // Sort chronologically by scheduled departure
  const sorted = [...records].sort(
    (a, b) => a.schedDeparture.getTime() - b.schedDeparture.getTime()
  );

  // 80/20 split: train on first 80%, test on last 20%
  const splitIdx = Math.floor(sorted.length * EVAL_CONFIG.trainRatio);
  const train = sorted.slice(0, splitIdx);
  const test = sorted.slice(splitIdx);

  if (train.length === 0 || test.length === 0) {
    return {
      strategy: "insufficient_data",
      foldsUsed: 0,
      metrics: { mae: 0, rmse: 0, r2: 0 },
    };
  }

  // Check minimum training examples
  if (train.length < EVAL_CONFIG.minTrainExamples) {
    return {
      strategy: "insufficient_data",
      foldsUsed: 0,
      metrics: { mae: 0, rmse: 0, r2: 0 },
    };
  }

  // Create buckets for train and test sets
  const trainBucket: TerminalPairBucket = {
    terminalPair: {
      departingTerminalAbbrev: records[0]?.departingTerminalAbbrev || "X",
      arrivingTerminalAbbrev: records[0]?.arrivingTerminalAbbrev || "Y",
    },
    records: train,
    bucketStats: {
      totalRecords: train.length,
      filteredRecords: train.length,
    },
  };
  const testBucket: TerminalPairBucket = {
    terminalPair: {
      departingTerminalAbbrev: records[0]?.departingTerminalAbbrev || "X",
      arrivingTerminalAbbrev: records[0]?.arrivingTerminalAbbrev || "Y",
    },
    records: test,
    bucketStats: {
      totalRecords: test.length,
      filteredRecords: test.length,
    },
  };

  // Create training examples for both sets
  const trainData = createTrainingDataForBucketBoth(trainBucket);
  const testData = createTrainingDataForBucketBoth(testBucket);
  const trainExamples =
    modelType === "departure"
      ? trainData.departureExamples
      : trainData.arrivalExamples;
  const testExamples =
    modelType === "departure"
      ? testData.departureExamples
      : testData.arrivalExamples;

  if (trainExamples.length === 0 || testExamples.length === 0) {
    return {
      strategy: "insufficient_data",
      foldsUsed: 0,
      metrics: { mae: 0, rmse: 0, r2: 0 },
    };
  }

  // Train model on training set
  const trainingResult = trainLinearRegression(trainExamples);

  // Evaluate on test set
  const x = testExamples.map((ex) => Object.values(ex.input) as number[]);
  const y = testExamples.map((ex) => ex.target);
  const predictions = x.map((features) => trainingResult.predict(features));
  const metrics = calculateMetrics(y, predictions);

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
 */
export const trainModelsForBucket = async (
  bucket: TerminalPairBucket
): Promise<ModelParameters[]> => {
  const results: ModelParameters[] = [];
  const pairKey = `${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`;

  console.log(
    `Training models for ${pairKey} (${bucket.records.length} records)`
  );

  // Create training data for both models
  const { departureExamples, arrivalExamples } =
    createTrainingDataForBucketBoth(bucket);

  // Train departure model
  const departureModel = await trainSingleModel(
    departureExamples,
    "departure",
    bucket
  );
  results.push(departureModel);

  // Train arrival model
  const arrivalModel = await trainSingleModel(
    arrivalExamples,
    "arrival",
    bucket
  );
  results.push(arrivalModel);
  return results;
};

/**
 * Train a single model for given examples
 */
const trainSingleModel = async (
  examples: TrainingExample[],
  modelType: "departure" | "arrival",
  bucket: TerminalPairBucket
): Promise<ModelParameters> => {
  const pairKey = `${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`;

  // Debug: Log first example FeatureVector and underlying FeatureRecord
  if (examples.length > 0) {
    const featureNames = Object.keys(examples[0].input);
    const sampleX0 = Object.fromEntries(
      featureNames.map((name) => [name, examples[0].input[name]])
    );
    console.log(`📊 First ${modelType} example FeatureVector:`, sampleX0);
    console.log(`📊 First ${modelType} example target:`, examples[0].target);

    // Extract first record for debugging (first example corresponds to first valid record)
    const firstRecord =
      modelType === "departure"
        ? bucket.records.find((r) => r.departureDelay != null)
        : bucket.records.find((r) => r.atSeaDuration != null);

    if (firstRecord) {
      const firstFeatureRecord: FeatureRecord = {
        prevDelay: firstRecord.prevDelay,
        tripStart: firstRecord.tripStart,
        schedDeparture: firstRecord.schedDeparture,
        meanAtDockDuration: firstRecord.meanAtDockDuration,
        ...(modelType === "arrival" && {
          delayMinutes: firstRecord.departureDelay,
          leftDock: firstRecord.leftDock,
        }),
      };
      console.log(
        `📊 First ${modelType} example underlying FeatureRecord:`,
        JSON.stringify(
          {
            prevDelay: firstFeatureRecord.prevDelay,
            tripStart: firstFeatureRecord.tripStart.toISOString(),
            schedDeparture: firstFeatureRecord.schedDeparture.toISOString(),
            meanAtDockDuration: firstFeatureRecord.meanAtDockDuration,
            delayMinutes: firstFeatureRecord.delayMinutes,
            leftDock: firstFeatureRecord.leftDock?.toISOString(),
          },
          null,
          2
        )
      );
    }
  }

  // Compute holdout evaluation metrics (if enabled)
  const holdoutResult = await computeHoldoutMetrics(bucket.records, modelType);

  // Train model on all available data
  const trainingResult = trainLinearRegression(examples);

  // Prepare feature matrix for metrics calculation on all data
  const x = examples.map((ex) => Object.values(ex.input) as number[]);
  const y = examples.map((ex) => ex.target);

  // Calculate predictions for metrics
  const predictions = x.map((features) => trainingResult.predict(features));

  // Calculate essential metrics (MAE, RMSE, R²) using shared function
  // Use holdout metrics if available, otherwise use in-sample metrics
  const { mae, rmse, r2 } =
    holdoutResult.strategy === "time_split"
      ? holdoutResult.metrics
      : calculateMetrics(y, predictions);

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
