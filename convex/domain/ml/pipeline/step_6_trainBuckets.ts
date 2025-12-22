// ============================================================================
// STEP 5: TRAIN BUCKET MODELS
// Model training for terminal pair buckets
// ============================================================================

import { PIPELINE_CONFIG } from "domain/ml/pipeline/shared/config";
import { createTrainingDataForBucketBoth } from "domain/ml/pipeline/step_4_createTrainingData";
import MLR from "ml-regression-multivariate-linear";
import type {
  ModelParameters,
  TerminalPairBucket,
  TrainingExample,
} from "../types";

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
  if (departureExamples.length >= PIPELINE_CONFIG.MIN_TRAINING_EXAMPLES) {
    const departureModel = await trainSingleModel(
      departureExamples,
      "departure",
      bucket
    );
    results.push(departureModel);
  } else {
    console.log(
      `Skipping departure model for ${pairKey}: only ${departureExamples.length} examples (need ${PIPELINE_CONFIG.MIN_TRAINING_EXAMPLES})`
    );
    results.push(createNullModel(bucket, "departure"));
  }

  // Train arrival model
  if (arrivalExamples.length >= PIPELINE_CONFIG.MIN_TRAINING_EXAMPLES) {
    const arrivalModel = await trainSingleModel(
      arrivalExamples,
      "arrival",
      bucket
    );
    results.push(arrivalModel);
  } else {
    console.log(
      `Skipping arrival model for ${pairKey}: only ${arrivalExamples.length} examples (need ${PIPELINE_CONFIG.MIN_TRAINING_EXAMPLES})`
    );
    results.push(createNullModel(bucket, "arrival"));
  }

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

  // Train model on all data (simplified approach)
  const x = examples.map((ex) => Object.values(ex.input) as number[]);
  const y = examples.map((ex) => ex.target);
  const { coefficients, intercept } = trainLinearRegression(x, y);

  // Calculate essential metrics only (MAE and R²)
  const predictions = x.map((features) => {
    let prediction = intercept;
    for (let i = 0; i < features.length; i++) {
      prediction += coefficients[i] * features[i];
    }
    return prediction;
  });

  const mae =
    y.reduce((sum, actual, i) => sum + Math.abs(actual - predictions[i]), 0) /
    y.length;

  const yMean = y.reduce((sum, val) => sum + val, 0) / y.length;
  const ssRes = y.reduce(
    (sum, actual, i) => sum + (actual - predictions[i]) ** 2,
    0
  );
  const ssTot = y.reduce((sum, actual) => sum + (actual - yMean) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  // Calculate RMSE for database compatibility (required by schema)
  const rmse = Math.sqrt(ssRes / y.length);

  const model: ModelParameters = {
    departingTerminalAbbrev: bucket.terminalPair.departingTerminalAbbrev,
    arrivingTerminalAbbrev: bucket.terminalPair.arrivingTerminalAbbrev,
    modelType,
    coefficients,
    intercept,
    trainingMetrics: {
      mae,
      rmse,
      r2,
    },
    createdAt: Date.now(),
    bucketStats: {
      totalRecords: bucket.bucketStats.totalRecords,
      filteredRecords: bucket.bucketStats.filteredRecords,
    },
  };

  console.log(
    `Trained ${modelType} model for ${pairKey}: ${examples.length} examples, MAE=${mae.toFixed(2)}, R²=${r2.toFixed(3)}`
  );

  return model;
};

/**
 * Create a null model record for insufficient data
 */
const createNullModel = (
  bucket: TerminalPairBucket,
  modelType: "departure" | "arrival"
): ModelParameters => {
  return {
    departingTerminalAbbrev: bucket.terminalPair.departingTerminalAbbrev,
    arrivingTerminalAbbrev: bucket.terminalPair.arrivingTerminalAbbrev,
    modelType,
    createdAt: Date.now(),
    bucketStats: {
      totalRecords: bucket.bucketStats.totalRecords,
      filteredRecords: bucket.bucketStats.filteredRecords,
    },
  };
};

/**
 * Train linear regression using MLR library
 */
const trainLinearRegression = (
  x: number[][],
  y: number[]
): { coefficients: number[]; intercept: number } => {
  const y2d = y.map((val) => [val]);
  const regression = new MLR(x, y2d);

  const coefficients = regression.weights.slice(0, -1).map((row) => row[0]);
  const intercept = regression.weights[regression.weights.length - 1][0];

  return { coefficients, intercept };
};
