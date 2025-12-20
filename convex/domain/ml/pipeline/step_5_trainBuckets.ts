// ============================================================================
// STEP 5: TRAIN BUCKET MODELS
// Model training orchestration for terminal pair buckets
// ============================================================================

import {
  PIPELINE_CONFIG,
  TRAINING_CONFIG,
} from "domain/ml/pipeline/shared/config";
import type { PipelineLogger } from "domain/ml/pipeline/shared/logging";
import { createTrainingDataForBucketBoth } from "domain/ml/pipeline/step_4_createTrainingData";
import { PipelineError, PipelineErrorType } from "domain/ml/types";
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
  bucket: TerminalPairBucket,
  logger: PipelineLogger
): Promise<ModelParameters[]> => {
  const results: ModelParameters[] = [];
  const pairKey = `${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`;

  logger.logBucketProcessing(bucket.terminalPair, bucket.records.length, {
    step: "trainBucket",
  });

  try {
    // Create training data for both models
    const { departureExamples, arrivalExamples } =
      createTrainingDataForBucketBoth(bucket, logger);

    // Train departure model
    if (departureExamples.length >= PIPELINE_CONFIG.MIN_TRAINING_EXAMPLES) {
      const departureModel = await trainSingleModel(
        departureExamples,
        "departure",
        bucket,
        logger
      );
      results.push(departureModel);
    } else {
      logger.warn(`Insufficient departure data for ${pairKey}`, {
        examples: departureExamples.length,
        required: PIPELINE_CONFIG.MIN_TRAINING_EXAMPLES,
      });
      // Still create record with null model
      results.push(createNullModel(bucket, "departure"));
    }

    // Train arrival model
    if (arrivalExamples.length >= PIPELINE_CONFIG.MIN_TRAINING_EXAMPLES) {
      const arrivalModel = await trainSingleModel(
        arrivalExamples,
        "arrival",
        bucket,
        logger
      );
      results.push(arrivalModel);
    } else {
      logger.warn(`Insufficient arrival data for ${pairKey}`, {
        examples: arrivalExamples.length,
        required: PIPELINE_CONFIG.MIN_TRAINING_EXAMPLES,
      });
      // Still create record with null model
      results.push(createNullModel(bucket, "arrival"));
    }
  } catch (error) {
    logger.logError(
      error as Error | string,
      "trainBucket",
      bucket.terminalPair,
      {
        recordCount: bucket.records.length,
      }
    );

    // Create null models for both types on error
    results.push(createNullModel(bucket, "departure"));
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
  bucket: TerminalPairBucket,
  logger: PipelineLogger
): Promise<ModelParameters> => {
  const pairKey = `${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`;

  try {
    // Extract feature names from first example
    const featureNames = Object.keys(examples[0].input);

    // Perform cross-validation
    const { avgMae, avgR2, avgRmse, stdDev } = performCrossValidation(examples);

    // Validate for overfitting
    if (avgR2 > TRAINING_CONFIG.OVERFITTING_R2_THRESHOLD) {
      logger.warn(`Potential overfitting detected: ${pairKey} ${modelType}`, {
        r2: avgR2.toFixed(3),
        examples: examples.length,
      });
    }

    // Check for suspiciously low MAE
    const avgTarget =
      examples.reduce((sum, ex) => sum + ex.target, 0) / examples.length;
    const relativeMae = avgMae / avgTarget;
    if (
      relativeMae < TRAINING_CONFIG.SUSPICIOUS_MAE_RATIO_THRESHOLD &&
      avgR2 > 0.9
    ) {
      logger.warn(`Suspiciously low MAE detected: ${pairKey} ${modelType}`, {
        mae: avgMae.toFixed(3),
        relativeMae: `${(relativeMae * 100).toFixed(1)}%`,
        r2: avgR2.toFixed(3),
      });
    }

    // Train final model on all data
    const x = examples.map((ex) => Object.values(ex.input) as number[]);
    const y = examples.map((ex) => ex.target);
    const { coefficients, intercept } = trainLinearRegression(x, y);

    const model: ModelParameters = {
      departingTerminalAbbrev: bucket.terminalPair.departingTerminalAbbrev,
      arrivingTerminalAbbrev: bucket.terminalPair.arrivingTerminalAbbrev,
      modelType,
      coefficients,
      featureNames,
      intercept,
      trainingMetrics: {
        mae: avgMae,
        rmse: avgRmse,
        r2: avgR2,
        stdDev,
      },
      createdAt: Date.now(),
      bucketStats: bucket.bucketStats,
    };

    logger.info(`Trained ${modelType} model for ${pairKey}`, {
      examples: examples.length,
      mae: avgMae.toFixed(2),
      r2: avgR2.toFixed(3),
      stdDev: stdDev.toFixed(2),
    });

    return model;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to train ${modelType} model for ${pairKey}`, {
      error: errorMessage,
      examples: examples.length,
    });
    throw new PipelineError(
      `Model training failed: ${errorMessage}`,
      PipelineErrorType.MODEL_TRAINING,
      "trainBucket",
      bucket.terminalPair,
      true,
      { examplesCount: examples.length }
    );
  }
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
    bucketStats: bucket.bucketStats,
    // coefficients, intercept, featureNames, trainingMetrics are undefined
  };
};

/**
 * Perform 5-fold cross-validation
 */
const performCrossValidation = (examples: TrainingExample[]) => {
  const k = PIPELINE_CONFIG.CROSS_VALIDATION_FOLDS;
  const foldSize = Math.floor(examples.length / k);
  const maes: number[] = [];
  const r2s: number[] = [];
  const rmses: number[] = [];

  for (let fold = 0; fold < k; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === k - 1 ? examples.length : (fold + 1) * foldSize;

    const testExamples = examples.slice(testStart, testEnd);
    const trainExamples = [
      ...examples.slice(0, testStart),
      ...examples.slice(testEnd),
    ];

    const xTrain = trainExamples.map(
      (ex) => Object.values(ex.input) as number[]
    );
    const yTrain = trainExamples.map((ex) => ex.target);
    const { coefficients, intercept } = trainLinearRegression(xTrain, yTrain);

    const xTest = testExamples.map((ex) => Object.values(ex.input) as number[]);
    const yTest = testExamples.map((ex) => ex.target);

    const predictions = xTest.map((features) => {
      let prediction = intercept;
      for (let i = 0; i < features.length; i++) {
        prediction += coefficients[i] * features[i];
      }
      return prediction;
    });

    const mae =
      yTest.reduce(
        (sum, actual, i) => sum + Math.abs(actual - predictions[i]),
        0
      ) / yTest.length;
    const rmse = Math.sqrt(
      yTest.reduce(
        (sum, actual, i) => sum + (actual - predictions[i]) ** 2,
        0
      ) / yTest.length
    );

    const yMean = yTest.reduce((sum, val) => sum + val, 0) / yTest.length;
    const ssRes = yTest.reduce(
      (sum, actual, i) => sum + (actual - predictions[i]) ** 2,
      0
    );
    const ssTot = yTest.reduce((sum, actual) => sum + (actual - yMean) ** 2, 0);
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    maes.push(mae);
    r2s.push(r2);
    rmses.push(rmse);
  }

  return {
    avgMae: maes.reduce((sum, val) => sum + val, 0) / maes.length,
    avgR2: r2s.reduce((sum, val) => sum + val, 0) / r2s.length,
    avgRmse: rmses.reduce((sum, val) => sum + val, 0) / rmses.length,
    stdDev: calculateStdDev(maes),
  };
};

/**
 * Calculate standard deviation
 */
const calculateStdDev = (values: number[]): number => {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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
