// ============================================================================
// ML - TRAINING PIPELINE
// End-to-end model training pipeline: data loading → windows → buckets → models
// ============================================================================

/**
 * ## ML Training Pipeline Overview
 *
 * This module orchestrates the complete ML training process for ferry schedule predictions.
 * The pipeline follows these steps:
 *
 * 1. **Data Loading**: Load historical WSF trip data (720 days back)
 * 2. **Window Creation**: Build training windows from consecutive vessel trips
 * 3. **Feature Extraction**: Transform windows into ML-ready feature records
 * 4. **Bucketing**: Group records by route for specialized model training
 * 5. **Model Training**: Train linear regression models for each route+model-type combination
 * 6. **Model Storage**: Save trained models to database for prediction service
 *
 * ## Pipeline Architecture
 *
 * - **Stateless Functions**: Each step is a pure function for testability
 * - **Parallel Processing**: Model training uses Promise.all for efficiency
 * - **Error Handling**: Invalid data is filtered out, not crashed upon
 * - **Memory Management**: Large datasets are processed in streams
 *
 * ## Quality Controls
 *
 * - Duration validation filters anomalous trip data
 * - Minimum training examples ensure statistical reliability
 * - Cross-validation provides performance metrics
 * - Feature leakage prevention through careful temporal ordering
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { createFeatureRecords } from "../shared/featureRecord";
import type { ModelParameters, TrainingResponse } from "../shared/types";
import { MODEL_KEYS } from "../shared/types";
import { createTrainingBuckets, createTrainingWindows } from "./data";
import { loadWsfTrainingData } from "./data/loadTrainingData";
import { storeModels, trainModel } from "./models";

/**
 * Train models for all buckets and model types in parallel.
 *
 * Creates a training task for every combination of:
 * - Route bucket (each terminal pair or chain with sufficient data)
 * - Model type (10 different prediction models)
 *
 * Uses Promise.all for parallel execution to maximize training throughput.
 * Filters out failed/null training results (e.g., insufficient data).
 *
 * @param buckets - Training data grouped by route
 * @returns Successfully trained model parameters
 */
const trainAllModels = async (
  buckets: ReturnType<typeof createTrainingBuckets>
): Promise<ModelParameters[]> => {
  // Generate all (bucket × model_type) combinations for parallel training
  const trainingTasks = buckets.flatMap((bucket) =>
    MODEL_KEYS.map(async (modelType) => trainModel(bucket, modelType))
  );

  // Execute all training tasks concurrently for efficiency
  const results = await Promise.all(trainingTasks);

  // Filter out failed training attempts (null results)
  return results.filter((m): m is ModelParameters => m !== null);
};

/**
 * Execute the complete ML training pipeline.
 *
 * This is the main entry point for retraining all ferry prediction models.
 * The process is designed to be idempotent and safe for production use.
 *
 * ## Pipeline Steps
 *
 * 1. **Clean Slate**: Delete existing models to prevent stale data
 * 2. **Data Loading**: Fetch 720 days of historical WSF trip data
 * 3. **Window Creation**: Build training windows from consecutive trips per vessel
 * 4. **Feature Extraction**: Transform windows into ML-ready feature vectors
 * 5. **Bucketing**: Group by route (terminal pairs) for specialized models
 * 6. **Model Training**: Train linear regression models for each route+type combination
 * 7. **Model Storage**: Persist trained models to database
 *
 * ## Memory Management
 *
 * - Large datasets are processed in stages to avoid memory pressure
 * - Intermediate data structures are cleared when no longer needed
 * - Streaming approach handles thousands of historical trips efficiently
 *
 * ## Error Handling
 *
 * - Individual model training failures don't stop the pipeline
 * - Data validation filters out invalid records
 * - Pipeline returns statistics even if some models fail to train
 *
 * @param ctx - Convex action context for database operations
 * @returns Training results with statistics and trained models
 */
export const runMLPipeline = async (
  ctx: ActionCtx
): Promise<TrainingResponse> => {
  // Load historical training data (720 days ≈ 2 years of ferry operations)
  // Note: Models are now versioned, so we don't delete existing models.
  // New training runs create dev-temp versions that can be promoted later.
  const wsfRecords = await loadWsfTrainingData();

  // Build training windows from consecutive vessel trips
  // This creates the temporal context needed for ML training
  let windows = createTrainingWindows(wsfRecords);

  // Extract features and targets from training windows
  // This transforms raw trip data into ML-ready examples
  const featureRecords = createFeatureRecords(windows);

  // Free memory - windows are no longer needed after feature extraction
  // Note: VesselHistory records remain accessible through references in featureRecords
  windows = [];

  // Group training examples by route for specialized model training
  const buckets = createTrainingBuckets(featureRecords);

  // Train models for all route+model-type combinations in parallel
  const models = await trainAllModels(buckets);

  // Persist trained models to database for prediction service
  await storeModels(models, ctx);

  // Return comprehensive training results and statistics
  return {
    models,
    stats: {
      totalFeatureRecords: featureRecords.length, // Total training examples processed
      bucketsProcessed: buckets.length, // Routes with sufficient training data
      modelsTrained: models.length, // Successfully trained models
    },
  };
};
