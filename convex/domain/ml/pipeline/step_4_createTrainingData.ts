// ============================================================================
// STEP 4: CREATE TRAINING DATA
// Feature engineering and training example creation
// ============================================================================

import { PIPELINE_CONFIG } from "domain/ml/pipeline/shared/config";
import type { PipelineLogger } from "domain/ml/pipeline/shared/logging";
import type {
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingExample,
} from "domain/ml/types";

/**
 * Create training data for a specific bucket and model type
 */
export const createTrainingDataForBucket = (
  bucket: TerminalPairBucket,
  modelType: "departure" | "arrival",
  logger: PipelineLogger
): TrainingExample[] => {
  const examples: TrainingExample[] = [];

  for (const record of bucket.records) {
    // Model-specific filtering and feature extraction
    if (modelType === "departure") {
      if (
        record.departureDelay != null &&
        record.tripStart &&
        record.scheduledDeparture
      ) {
        examples.push({
          input: extractDepartureFeatures(record),
          target: record.departureDelay,
        });
      }
    } else {
      // arrival
      if (
        record.atSeaDuration != null &&
        record.leftDock &&
        record.scheduledDeparture &&
        record.delay != null
      ) {
        examples.push({
          input: extractArrivalFeatures(record),
          target: record.atSeaDuration,
        });
      }
    }
  }

  // Update bucket stats with filtered count
  bucket.bucketStats.filteredRecords = examples.length;

  logger.debug(
    `Created training data for ${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`,
    {
      modelType,
      totalRecords: bucket.records.length,
      trainingExamples: examples.length,
      filterRate: `${(
        ((bucket.records.length - examples.length) / bucket.records.length) *
          100
      ).toFixed(1)}%`,
    }
  );

  return examples;
};

/**
 * Create training data for both models in a bucket
 */
export const createTrainingDataForBucketBoth = (
  bucket: TerminalPairBucket,
  logger: PipelineLogger
): {
  departureExamples: TrainingExample[];
  arrivalExamples: TrainingExample[];
} => {
  logger.logBucketProcessing(bucket.terminalPair, bucket.records.length, {
    step: "createTrainingData",
  });

  const departureExamples = createTrainingDataForBucket(
    bucket,
    "departure",
    logger
  );
  const arrivalExamples = createTrainingDataForBucket(
    bucket,
    "arrival",
    logger
  );

  return { departureExamples, arrivalExamples };
};

/**
 * Extract features for departure model
 * IMPORTANT: Only use features available at the time of vessel arrival
 */
const extractDepartureFeatures = (record: TrainingDataRecord) => {
  const scheduleDelta = calculateScheduleDelta(
    record.tripStart,
    record.scheduledDeparture
  );
  const scheduleDeltaClamped = Math.min(
    PIPELINE_CONFIG.MAX_SCHEDULE_DELTA_MINUTES,
    Math.max(-Infinity, scheduleDelta)
  );

  const hourOfDay = record.tripStart.getHours();
  const dayOfWeek = record.tripStart.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    schedule_delta_clamped: scheduleDeltaClamped,
    hour_of_day: hourOfDay,
    is_weekend: isWeekend ? 1 : 0,
    // Removed delay_minutes to prevent data leakage - it's calculated from actual departure time
  };
};

/**
 * Extract features for arrival model
 */
const extractArrivalFeatures = (record: TrainingDataRecord) => {
  const scheduleDelta = calculateScheduleDelta(
    record.leftDock,
    record.scheduledDeparture
  );
  const scheduleDeltaClamped = Math.min(
    PIPELINE_CONFIG.MAX_SCHEDULE_DELTA_MINUTES,
    Math.max(-Infinity, scheduleDelta)
  );

  const hourOfDay = record.leftDock.getHours();
  const dayOfWeek = record.leftDock.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    schedule_delta_clamped: scheduleDeltaClamped,
    hour_of_day: hourOfDay,
    is_weekend: isWeekend ? 1 : 0,
    delay_minutes: record.delay || 0,
  };
};

/**
 * Calculate schedule delta in minutes (positive = ahead of schedule)
 */
const calculateScheduleDelta = (
  actualTime: Date,
  scheduledTime: Date
): number => {
  const actualMs = actualTime.getTime();
  const scheduledMs = scheduledTime.getTime();
  return (scheduledMs - actualMs) / (1000 * 60); // Convert to minutes
};
