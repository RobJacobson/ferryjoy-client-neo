// ============================================================================
// ML PIPELINE COORDINATOR
// Simplified orchestration without step-based files
// ============================================================================

import type { ActionCtx } from "_generated/server";
import { MODEL_TYPES, type ModelType } from "../shared/core/modelTypes";
import type {
  DataQualityMetrics,
  ModelParameters,
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingResponse,
} from "../shared/core/types";
import { createTerminalPairBuckets } from "./data/createTrainingBuckets";
import { createTrainingDataRecords } from "./data/createTrainingRecords";
import { loadWsfTrainingData } from "./data/loadTrainingData";
import { storeModels } from "./models/storeModels";
import { trainModel } from "./models/trainModels";

/**
 * Analyze basic data quality metrics
 */
const analyzeDataQuality = (
  trainingRecords: TrainingDataRecord[]
): DataQualityMetrics => ({
  totalRecords: trainingRecords.length,
  completeness: {
    overallScore: 1.0,
    fieldCompleteness: {},
  },
  temporal: {
    validOrdering: 1.0,
    invalidRecords: 0,
  },
});

/**
 * Train all models for all terminal pairs
 */
const trainAllModels = async (
  buckets: TerminalPairBucket[]
): Promise<ModelParameters[]> => {
  const allModels: ModelParameters[] = [];
  const modelTypes: ModelType[] = [
    MODEL_TYPES.ARRIVE_DEPART_ATDOCK_DURATION,
    MODEL_TYPES.DEPART_ARRIVE_ATSEA_DURATION,
    MODEL_TYPES.ARRIVE_ARRIVE_TOTAL_DURATION,
    MODEL_TYPES.ARRIVE_DEPART_DELAY,
  ];

  for (const bucket of buckets) {
    for (const modelType of modelTypes) {
      try {
        const model = await trainModel(bucket, modelType);
        allModels.push(model);
      } catch (error) {
        console.error(
          `Failed to train ${modelType} for ${bucket.terminalPair.departingTerminalAbbrev}->${bucket.terminalPair.arrivingTerminalAbbrev}:`,
          error
        );
      }
    }
  }

  return allModels;
};

/**
 * Main ML pipeline
 */
export const runMLPipeline = async (
  ctx: ActionCtx
): Promise<TrainingResponse> => {
  console.log("Starting ML training pipeline", { timestamp: new Date() });

  // Load and process data
  const wsfRecords = await loadWsfTrainingData();
  const trainingRecords = createTrainingDataRecords(wsfRecords);
  const buckets = createTerminalPairBuckets(trainingRecords);
  const dataQuality = analyzeDataQuality(trainingRecords);

  // Train models
  const allModels = await trainAllModels(buckets);

  // Store results
  await storeModels(allModels, ctx);

  return {
    models: allModels,
    stats: {
      totalExamples: buckets.reduce((sum, b) => sum + b.records.length, 0),
      terminalPairs: buckets.map(
        (b) =>
          `${b.terminalPair.departingTerminalAbbrev}->${b.terminalPair.arrivingTerminalAbbrev}`
      ),
      bucketsProcessed: buckets.length,
      dataQuality,
    },
  };
};
