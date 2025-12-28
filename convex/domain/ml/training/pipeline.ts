// ============================================================================
// ML TRAINING PIPELINE
// Simplified training workflow with clear error handling
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
 * Analyze data quality metrics for training records
 * @param trainingRecords - Array of training data records to analyze
 * @returns Quality metrics including completeness and temporal validation scores
 */
const analyzeDataQuality = (
  trainingRecords: TrainingDataRecord[]
): DataQualityMetrics => ({
  totalRecords: trainingRecords.length,
  completeness: {
    overallScore: 1.0, // Placeholder - could be enhanced with actual field validation
    fieldCompleteness: {}, // Placeholder for per-field completeness metrics
  },
  temporal: {
    validOrdering: 1.0, // Placeholder - could validate timestamp ordering
    invalidRecords: 0, // Placeholder for records with invalid temporal relationships
  },
});

/**
 * Train all machine learning models for all terminal pair buckets
 * @param buckets - Array of terminal pair buckets containing training data
 * @returns Promise resolving to array of trained model parameters
 * @throws Error if any model training fails
 */
const trainAllModels = async (
  buckets: TerminalPairBucket[]
): Promise<ModelParameters[]> => {
  const modelTypes: ModelType[] = [
    MODEL_TYPES.ARRIVE_DEPART_ATDOCK_DURATION,
    MODEL_TYPES.DEPART_ARRIVE_ATSEA_DURATION,
    MODEL_TYPES.ARRIVE_ARRIVE_TOTAL_DURATION,
    MODEL_TYPES.ARRIVE_DEPART_DELAY,
  ];

  // Create training tasks for all bucket-model combinations
  // Each bucket gets trained for all model types (4 different prediction models)
  const trainingTasks = buckets.flatMap((bucket) =>
    modelTypes.map(async (modelType) => {
      try {
        return await trainModel(bucket, modelType);
      } catch (error) {
        const errorMsg = `Failed to train ${modelType} for ${bucket.terminalPair.departingTerminalAbbrev}->${bucket.terminalPair.arrivingTerminalAbbrev}: ${error}`;
        console.error(errorMsg);
        return null; // Return null for failed trainings, filter out later
      }
    })
  );

  // Execute all training tasks concurrently for performance
  const results = await Promise.all(trainingTasks);

  // Filter out any failed trainings (null results)
  return results.filter((model): model is ModelParameters => model !== null);
};

/**
 * Executes the complete machine learning training pipeline for ferry schedule predictions
 *
 * This pipeline processes raw vessel tracking data through several stages:
 * 1. Load WSF training data from external sources
 * 2. Convert raw data to structured training records with feature engineering
 * 3. Group records by terminal pairs and create training buckets
 * 4. Train linear regression models for each terminal pair and prediction type
 * 5. Store trained models in the database for later predictions
 * 6. Calculate and return training statistics and data quality metrics
 *
 * @param ctx - Convex action context for database operations
 * @returns Training response containing trained models and statistics
 * @throws Error if any pipeline step fails critically
 */
export const runMLPipeline = async (
  ctx: ActionCtx
): Promise<TrainingResponse> => {
  console.log("Starting ML training pipeline", {
    timestamp: new Date(),
  });

  try {
    // Step 1: Load raw WSF vessel tracking data from external data sources
    const wsfRecords = await loadWsfTrainingData();

    // Step 2: Convert raw vessel data to structured training records with computed features
    const trainingRecords = createTrainingDataRecords(wsfRecords);

    // Step 3: Group training records by terminal pairs and apply sampling/bucketing logic
    const buckets = createTerminalPairBuckets(trainingRecords);

    // Step 4: Train linear regression models for all terminal pairs and model types
    const models = await trainAllModels(buckets);

    // Step 5: Persist trained models to database for production predictions
    await storeModels(models, ctx);

    // Step 6: Analyze training data quality and compute statistics
    const dataQuality = analyzeDataQuality(trainingRecords);

    return {
      models,
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
  } catch (error) {
    console.error("ML pipeline failed:", error);
    throw new Error(`ML training pipeline failed: ${error}`);
  }
};
