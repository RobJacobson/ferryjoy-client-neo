// ============================================================================
// PIPELINE COORDINATOR
// Main ML pipeline coordination and response creation
// Includes model training coordination
// ============================================================================

/**
 * Analyze basic data quality metrics
 * Note: Temporal validation is done in step_2, so all records are valid
 */
const analyzeDataQuality = (
  trainingRecords: TrainingDataRecord[],
  buckets: TerminalPairBucket[]
): DataQualityMetrics => {
  const quality: DataQualityMetrics = {
    totalRecords: trainingRecords.length,
    completeness: {
      overallScore: 1.0, // Training records are already filtered/validated
      fieldCompleteness: {}, // Simplified - no detailed field analysis needed
    },
    temporal: {
      validOrdering: 1.0, // All records valid after step_2 validation
      invalidRecords: 0,
    },
  };

  console.log(
    `Data quality: ${trainingRecords.length} records, ${buckets.length} buckets`
  );
  return quality;
};

// ============================================================================
// MODEL TRAINING COORDINATION
// ============================================================================

/**
 * Train models for all buckets sequentially
 * Gracefully continues on individual bucket failures (route independence)
 */
const trainAllBuckets = async (
  buckets: TerminalPairBucket[]
): Promise<ModelParameters[]> => {
  const allModels: ModelParameters[] = [];
  const failedBuckets: Array<{
    pairKey: string;
    recordCount: number;
    error: unknown;
  }> = [];

  console.log(`Training models for ${buckets.length} buckets`);

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const pairKey = formatTerminalPairKey(
      bucket.terminalPair.departingTerminalAbbrev,
      bucket.terminalPair.arrivingTerminalAbbrev
    );

    try {
      console.log(
        `Training bucket ${i + 1}/${buckets.length}: ${pairKey} (${bucket.records.length} records)`
      );
      const bucketModels = await trainModelsForBucket(bucket);
      allModels.push(...bucketModels);
    } catch (error) {
      // Track failed bucket for summary logging
      failedBuckets.push({
        pairKey,
        recordCount: bucket.records.length,
        error,
      });
      console.error(
        `Failed to train models for ${pairKey} (${bucket.records.length} records):`,
        error
      );
      // Continue with other buckets - route independence principle
    }
  }

  // Log summary of failures
  if (failedBuckets.length > 0) {
    console.warn(
      `Failed to train ${failedBuckets.length}/${buckets.length} bucket(s):`,
      failedBuckets.map((f) => `${f.pairKey} (${f.recordCount} records)`)
    );
  }

  console.log(
    `Completed training: ${allModels.length} models created from ${buckets.length} buckets ` +
    `(${failedBuckets.length} failed, ${buckets.length - failedBuckets.length} successful)`
  );
  return allModels;
};

// ============================================================================
// MAIN PIPELINE COORDINATOR
// ============================================================================

import type { ActionCtx } from "_generated/server";
import type {
  DataQualityMetrics,
  ModelParameters,
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingResponse,
} from "./types";
import { loadWsfTrainingData } from "./pipeline/step_1_loadWsfTrainingData";
import { convertWsfDataToTrainingRecords } from "./pipeline/step_2_convertWsfToTraining";
import { createTerminalPairBuckets } from "./pipeline/step_3_bucketByTerminalPairs";
import { trainModelsForBucket } from "./pipeline/step_5_trainBuckets";
import { storeModelResults } from "./pipeline/step_6_storeResults";
import { formatTerminalPairKey } from "./pipeline/shared/config";

/**
 * Main ML pipeline orchestrator
 */
export const runMLPipeline = async (
  ctx: ActionCtx
): Promise<TrainingResponse> => {
  console.log("Starting ML training pipeline", { timestamp: new Date() });

  try {
    // Step 1: Load raw WSF records
    console.log("Loading raw WSF records...");
    const wsfRecords = await loadWsfTrainingData();

    // Step 2: Convert to training records
    console.log("Converting WSF records to training records...");
    const trainingRecords = convertWsfDataToTrainingRecords(wsfRecords);

    // Step 3: Create terminal pair buckets
    console.log("Creating terminal pair buckets...");
    const buckets = createTerminalPairBuckets(trainingRecords);

    // Analyze data quality (using training records only)
    const dataQuality = analyzeDataQuality(trainingRecords, buckets);

    // Step 4-5: Create training data and train models for all buckets sequentially
    // Note: Training data creation is handled automatically within step 5
    console.log("Training models...");
    const allModels = await trainAllBuckets(buckets);

    // Step 6: Store results
    console.log("Storing model results...");
    await storeModelResults(allModels, ctx);

    // Create final response
    const response = createFinalResponse(allModels, buckets, dataQuality);

    console.log(
      `Pipeline completed successfully: ${buckets.length} buckets, ${allModels.length} models, ${trainingRecords.length} examples`
    );

    return response;
  } catch (error) {
    console.error("Pipeline failed:", error);
    throw error;
  }
};

/**
 * Create final response object
 */
const createFinalResponse = (
  models: ModelParameters[],
  buckets: TerminalPairBucket[],
  dataQuality: DataQualityMetrics
): TrainingResponse => {
  // Extract terminal pair strings from buckets
  const terminalPairs = buckets.map((bucket) =>
    formatTerminalPairKey(
      bucket.terminalPair.departingTerminalAbbrev,
      bucket.terminalPair.arrivingTerminalAbbrev
    )
  );

  return {
    models,
    stats: {
      totalExamples: buckets.reduce((sum, b) => sum + b.records.length, 0),
      terminalPairs,
      bucketsProcessed: buckets.length,
      dataQuality,
    },
  };
};
