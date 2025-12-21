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

  const hourOfDay = getPacificHour(record.tripStart);
  const timeCategory = getTimeOfDayCategory(hourOfDay);
  const dayOfWeek = record.tripStart.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    schedule_delta_clamped: scheduleDeltaClamped,
    time_category: timeCategory, // Using categorical time periods for ferry operations
    is_weekend: isWeekend ? 1 : 0,
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

  const hourOfDay = getPacificHour(record.leftDock);
  const timeCategory = getTimeOfDayCategory(hourOfDay);
  const dayOfWeek = record.leftDock.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    schedule_delta_clamped: scheduleDeltaClamped,
    time_category: timeCategory, // Using categorical time periods for ferry operations
    is_weekend: isWeekend ? 1 : 0,
    delay_minutes: 0, // Placeholder for future features
  };
};

/**
 * Convert UTC Date to Pacific Time hour, accounting for DST in 2025
 * Pacific Time: UTC-8 (PST) normally, UTC-7 (PDT) during DST
 */
const getPacificHour = (utcDate: Date): number => {
  const utcTime = utcDate.getTime();

  // DST periods for 2025
  // DST starts March 9, 2025 at 2:00 AM PDT = 10:00 AM UTC (spring forward)
  // DST ends November 2, 2025 at 2:00 AM PST = 9:00 AM UTC (fall back)
  const dstStart = new Date("2025-03-09T10:00:00Z").getTime();
  const dstEnd = new Date("2025-11-02T09:00:00Z").getTime();

  // Check if date falls within DST period
  const isDST = utcTime >= dstStart && utcTime < dstEnd;

  // Pacific offset: -8 hours (PST) or -7 hours (PDT)
  const pacificOffset = isDST ? -7 * 60 * 60 * 1000 : -8 * 60 * 60 * 1000;

  const pacificTime = new Date(utcTime + pacificOffset);
  return pacificTime.getHours();
};

/**
 * Categorize hour of day into ferry operation time periods
 * Uses Pacific Time (PST/PDT) to align with local ferry operations
 * Returns 0-5 representing different operational patterns:
 * 0: Late night/Early morning (quietest, most predictable)
 * 1: Early morning prep
 * 2: Morning rush hour
 * 3: Midday
 * 4: Afternoon rush hour
 * 5: Evening
 */
const getTimeOfDayCategory = (hour: number): number => {
  if (hour >= 22 || hour < 5) return 0; // Late night/Early morning (22:00-04:59)
  if (hour >= 5 && hour < 7) return 1; // Early morning prep (05:00-06:59)
  if (hour >= 7 && hour < 10) return 2; // Morning rush (07:00-09:59)
  if (hour >= 10 && hour < 15) return 3; // Midday (10:00-14:59)
  if (hour >= 15 && hour < 18) return 4; // Afternoon rush (15:00-17:59)
  if (hour >= 18 && hour < 22) return 5; // Evening (18:00-21:59)
  return 0; // Fallback
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
