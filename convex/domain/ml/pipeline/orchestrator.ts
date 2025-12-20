// ============================================================================
// ML PIPELINE ORCHESTRATOR
// Coordinates the entire ML training pipeline
// ============================================================================

import type { ActionCtx } from "_generated/server";
import type { PipelineLogger } from "domain/ml/pipeline/shared/logging";
import { createPipelineLogger } from "domain/ml/pipeline/shared/logging";
import { createPerformanceTracker } from "domain/ml/pipeline/shared/performance";
import { loadAllConvexTrips } from "domain/ml/pipeline/step_1a_loadAllConvexTrips";
import { loadAllWSFTrips } from "domain/ml/pipeline/step_1b_loadAllWSFTrips";
import { createTerminalPairBuckets } from "domain/ml/pipeline/step_3_bucketByTerminalPairs";
import { trainModelsForBucket } from "domain/ml/pipeline/step_5_trainBuckets";
import { storeModelResults } from "domain/ml/pipeline/step_6_storeResults";
import type {
  DataQualityMetrics,
  ModelParameters,
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingResponse,
} from "domain/ml/types";
import { PipelineError, PipelineErrorType } from "domain/ml/types";
import type {
  PerformanceMetrics,
  PerformanceTracker,
} from "./shared/performance";

/**
 * Data source type for ML pipeline
 */
export type DataSourceType = "convex" | "wsf";

/**
 * Main ML pipeline orchestrator
 */
export const runMLPipeline = async (
  ctx: ActionCtx,
  dataSource: DataSourceType = "convex"
): Promise<TrainingResponse> => {
  const pipelineId = `ml-pipeline-${Date.now()}`;
  const logger = createPipelineLogger(pipelineId);
  const perfTracker = createPerformanceTracker();
  const errors: PipelineError[] = [];

  logger.info("Starting ML training pipeline", { timestamp: new Date() });

  try {
    // Step 1: Load training data from data source
    const loadStepName =
      dataSource === "convex" ? "loadAllConvexTrips" : "loadAllWSFTrips";
    const loadFunction =
      dataSource === "convex" ? loadAllConvexTrips : loadAllWSFTrips;

    const loadResult = await loadWithErrorHandling(
      () => loadFunction(ctx, logger),
      loadStepName,
      logger,
      perfTracker
    );
    const trainingRecords = loadResult.result;

    // Step 3: Create terminal pair buckets
    const bucketResult = measureSyncWithErrorHandling(
      () => createTerminalPairBuckets(trainingRecords, logger),
      "createBuckets",
      logger,
      perfTracker
    );
    const buckets = bucketResult.result;

    // Analyze data quality (using training records only)
    const dataQuality = analyzeDataQuality(trainingRecords, buckets, logger);

    // Step 4-5: Train models for all buckets sequentially
    const allModels = await trainAllBuckets(
      buckets,
      logger,
      perfTracker,
      errors
    );

    // Step 6: Store results
    await storeWithErrorHandling(
      () => storeModelResults(allModels, ctx, logger),
      "storeResults",
      logger,
      perfTracker,
      { modelCount: allModels.length }
    );

    // Create final response
    const response = createFinalResponse(
      allModels,
      buckets,
      dataQuality,
      errors,
      logger
    );

    logger.logPipelineComplete(
      {
        bucketsProcessed: buckets.length,
        modelsTrained: allModels.length,
        totalExamples: trainingRecords.length,
      },
      errors.length
    );

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.fatal("Pipeline failed catastrophically", { error: errorMessage });
    throw error;
  }
};

/**
 * Train models for all buckets sequentially
 */
const trainAllBuckets = async (
  buckets: TerminalPairBucket[],
  logger: PipelineLogger,
  perfTracker: PerformanceTracker,
  errors: PipelineError[]
): Promise<ModelParameters[]> => {
  const allModels: ModelParameters[] = [];

  logger.logStepStart("trainAllBuckets", { bucketCount: buckets.length });

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];

    try {
      logger.info(`Training bucket ${i + 1}/${buckets.length}`, {
        pair: `${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`,
        records: bucket.records.length,
      });

      const trainResult = await measureWithErrorHandling(
        () => trainModelsForBucket(bucket, logger),
        `trainBucket_${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`,
        logger,
        perfTracker
      );

      allModels.push(...trainResult.result);
    } catch (error) {
      logger.logError(
        error as Error | string,
        "trainAllBuckets",
        bucket.terminalPair,
        {
          bucketIndex: i,
          totalBuckets: buckets.length,
        }
      );
      if (error instanceof PipelineError) {
        errors.push(error);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push(
          new PipelineError(
            errorMessage,
            PipelineErrorType.MODEL_TRAINING,
            "trainAllBuckets",
            bucket.terminalPair,
            true
          )
        );
      }

      // Continue with other buckets - don't fail the entire pipeline
    }
  }

  logger.logStepEnd("trainAllBuckets", 0, {
    bucketsAttempted: buckets.length,
    modelsCreated: allModels.length,
    errors: errors.length,
  });

  return allModels;
};

/**
 * Analyze data quality across the pipeline
 */
const analyzeDataQuality = (
  trainingRecords: TrainingDataRecord[],
  _buckets: TerminalPairBucket[],
  logger: PipelineLogger
): DataQualityMetrics => {
  const quality: DataQualityMetrics = {
    totalRecords: trainingRecords.length,
    completeness: {
      overallScore: 1.0, // Training records are already filtered/validated
      fieldCompleteness: calculateFieldCompleteness(trainingRecords),
    },
    temporal: {
      validOrdering: calculateTemporalConsistency(trainingRecords),
      invalidRecords:
        trainingRecords.length -
        calculateTemporalConsistency(trainingRecords) * trainingRecords.length,
    },
    statistical: {
      durationSkewness: calculateDurationSkewness(trainingRecords),
      outlierPercentage: calculateOutlierPercentage(trainingRecords),
    },
  };

  logger.logQualityMetrics(quality);
  return quality;
};

/**
 * Helper functions for data quality analysis
 */
const calculateFieldCompleteness = (records: TrainingDataRecord[]) => ({
  tripStart: records.filter((r) => !!r.tripStart).length / records.length,
  leftDock: records.filter((r) => !!r.leftDock).length / records.length,
  tripEnd: records.filter((r) => !!r.tripEnd).length / records.length,
  atDockDuration: 1.0, // Not available in TrainingDataRecord
  atSeaDuration:
    records.filter((r) => r.atSeaDuration != null).length / records.length,
});

const calculateTemporalConsistency = (
  records: TrainingDataRecord[]
): number => {
  const validRecords = records.filter(
    (r) =>
      r.tripStart &&
      r.leftDock &&
      r.tripEnd &&
      r.tripStart < r.leftDock &&
      r.leftDock < r.tripEnd
  ).length;
  return validRecords / records.length;
};

const calculateDurationSkewness = (records: TrainingDataRecord[]): number => {
  const durations = records
    .map((r) => r.departureDelay)
    .filter((d) => d != null) as number[];

  if (durations.length === 0) return 0;

  const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const variance =
    durations.reduce((sum, d) => sum + (d - mean) ** 2, 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  const skewness =
    durations.reduce((sum, d) => sum + ((d - mean) / stdDev) ** 3, 0) /
    durations.length;
  return skewness;
};

const calculateOutlierPercentage = (records: TrainingDataRecord[]): number => {
  const durations = records
    .map((r) => r.departureDelay)
    .filter((d) => d != null) as number[];

  if (durations.length === 0) return 0;

  const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const stdDev = Math.sqrt(
    durations.reduce((sum, d) => sum + (d - mean) ** 2, 0) / durations.length
  );

  const outliers = durations.filter(
    (d) => Math.abs(d - mean) > 2 * stdDev
  ).length;
  return outliers / durations.length;
};

/**
 * Create final response object
 */
type TerminalPairBreakdown = Record<
  string,
  {
    departure?: {
      count: number;
      filteredRecords: number;
      avgPrediction?: number;
      stdDev?: number;
      mae?: number;
      r2?: number;
      meanDepartureDelay?: number;
    };
    arrival?: {
      count: number;
      filteredRecords: number;
      avgPrediction?: number;
      stdDev?: number;
      mae?: number;
      r2?: number;
    };
  }
>;

const createFinalResponse = (
  models: ModelParameters[],
  buckets: TerminalPairBucket[],
  dataQuality: DataQualityMetrics,
  errors: PipelineError[],
  _logger: PipelineLogger
): TrainingResponse => {
  const terminalPairBreakdown: TerminalPairBreakdown = {};

  // Build breakdown by terminal pair
  buckets.forEach((bucket) => {
    const pairKey = `${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`;
    terminalPairBreakdown[pairKey] = {};

    // Find models for this pair
    const departureModel = models.find(
      (m) =>
        m.departingTerminalAbbrev ===
          bucket.terminalPair.departingTerminalAbbrev &&
        m.arrivingTerminalAbbrev ===
          bucket.terminalPair.arrivingTerminalAbbrev &&
        m.modelType === "departure"
    );

    const arrivalModel = models.find(
      (m) =>
        m.departingTerminalAbbrev ===
          bucket.terminalPair.departingTerminalAbbrev &&
        m.arrivingTerminalAbbrev ===
          bucket.terminalPair.arrivingTerminalAbbrev &&
        m.modelType === "arrival"
    );

    if (departureModel?.trainingMetrics) {
      terminalPairBreakdown[pairKey].departure = {
        count: bucket.records.length,
        filteredRecords: bucket.bucketStats.filteredRecords,
        mae: departureModel.trainingMetrics.mae,
        r2: departureModel.trainingMetrics.r2,
      };
    }

    if (arrivalModel?.trainingMetrics) {
      terminalPairBreakdown[pairKey].arrival = {
        count: bucket.records.length,
        filteredRecords: bucket.bucketStats.filteredRecords,
        mae: arrivalModel.trainingMetrics.mae,
        r2: arrivalModel.trainingMetrics.r2,
      };
    }
  });

  return {
    success: errors.length === 0,
    models,
    stats: {
      totalExamples: buckets.reduce((sum, b) => sum + b.records.length, 0),
      terminalPairs: Object.keys(terminalPairBreakdown),
      bucketsProcessed: buckets.length,
      dataQuality,
      terminalPairBreakdown,
    },
    errors: errors.map((e) => ({
      type: e.type,
      message: e.message,
      step: e.step,
      bucket: e.bucket
        ? `${e.bucket.departingTerminalAbbrev}_${e.bucket.arrivingTerminalAbbrev}`
        : undefined,
      recoverable: e.recoverable,
    })),
  };
};

/**
 * Error handling wrappers
 */
const loadWithErrorHandling = async <T>(
  fn: () => Promise<T>,
  step: string,
  logger: PipelineLogger,
  perfTracker: PerformanceTracker
): Promise<{ result: T; metrics: PerformanceMetrics }> => {
  const _tracker = perfTracker.start(step);
  try {
    const result = await fn();
    const metrics = perfTracker.end(step);
    return { result, metrics };
  } catch (error) {
    perfTracker.end(step, { error: true });
    logger.logError(error as Error | string, step);
    throw error;
  }
};

const measureWithErrorHandling = async <T>(
  fn: () => Promise<T>,
  step: string,
  logger: PipelineLogger,
  perfTracker: PerformanceTracker
): Promise<{ result: T; metrics: PerformanceMetrics }> => {
  const _tracker = perfTracker.start(step);
  try {
    const result = await fn();
    const metrics = perfTracker.end(step);
    return { result, metrics };
  } catch (error) {
    perfTracker.end(step, { error: true });
    logger.logError(error as Error | string, step);
    throw error;
  }
};

const measureSyncWithErrorHandling = <T>(
  fn: () => T,
  step: string,
  logger: PipelineLogger,
  perfTracker: PerformanceTracker
): { result: T; metrics: PerformanceMetrics } => {
  const _tracker = perfTracker.start(step);
  try {
    const result = fn();
    const metrics = perfTracker.end(step);
    return { result, metrics };
  } catch (error) {
    perfTracker.end(step, { error: true });
    logger.logError(error as Error | string, step);
    throw error;
  }
};

const storeWithErrorHandling = async (
  fn: () => Promise<void>,
  step: string,
  logger: PipelineLogger,
  perfTracker: PerformanceTracker,
  context?: Record<string, unknown>
): Promise<void> => {
  const _tracker = perfTracker.start(step, context);
  try {
    await fn();
    perfTracker.end(step);
  } catch (error) {
    perfTracker.end(step, { error: true });
    logger.logError(error as Error | string, step);
    throw error;
  }
};
