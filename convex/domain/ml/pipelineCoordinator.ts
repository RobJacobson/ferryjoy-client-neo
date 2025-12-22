// ============================================================================
// PIPELINE COORDINATOR
// Main ML pipeline coordination and response creation
// ============================================================================

import type { ActionCtx } from "_generated/server";
import type {
  DataQualityMetrics,
  ModelParameters,
  TerminalPairBucket,
  TrainingResponse,
} from "./types";
import { analyzeDataQuality } from "./pipeline/shared/dataQualityAnalyzer";
import { trainAllBuckets } from "./pipeline/shared/modelTrainingCoordinator";
import { loadWsfTrainingData } from "./pipeline/step_1_loadWsfTrainingData";
import { convertWsfDataToTrainingRecords } from "./pipeline/step_2_convertWsfToTraining";
import { createTerminalPairBuckets } from "./pipeline/step_3_bucketByTerminalPairs";
import { storeModelResults } from "./pipeline/step_5_storeResults";

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

    // Step 4: Create training data for all buckets
    // (handled automatically by step 6)

    // Step 5: Train models for all buckets sequentially
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
  const terminalPairs = buckets.map(
    (bucket) =>
      `${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`
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
