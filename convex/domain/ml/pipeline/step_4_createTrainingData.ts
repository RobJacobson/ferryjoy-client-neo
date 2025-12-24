// ============================================================================
// STEP 4: CREATE TRAINING DATA
// Feature engineering and training example creation
// ============================================================================

import type {
  FeatureRecord,
  FeatureVector,
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingExample,
} from "../types";
import { getMinutesDelta, getPacificTime } from "./shared/time";

/**
 * Round very small values to zero to clean up numerical noise
 */
const roundTinyValues = (value: number, threshold: number = 1e-10): number => {
  return Math.abs(value) < threshold ? 0 : value;
};

/**
 * Create smooth time-of-day features using Gaussian radial basis functions
 * Evenly distributed centers every 3 hours for comprehensive daily coverage
 */
const getTimeOfDaySmooth = (
  schedDeparturePacificTime: Date
): Record<string, number> => {
  const hourOfDay =
    schedDeparturePacificTime.getHours() +
    schedDeparturePacificTime.getMinutes() / 60;

  // Every 3 hours, with peaks around 8:00 AM and 5:00 PM
  const centers = [2, 5, 8, 11, 14, 17, 20, 23];

  // Adaptive standard deviation based on center spacing
  // For N centers in 24 hours: spacing = 24/N, sigma = spacing * 0.5 for good overlap
  const sigma = (12 / centers.length) * 0.5;

  const features: Record<string, number> = {};

  centers.forEach((center, index) => {
    // Calculate minimum distance considering 24-hour wraparound
    const distance = Math.min(
      Math.abs(hourOfDay - center),
      24 - Math.abs(hourOfDay - center)
    );

    // Gaussian radial basis function
    const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));

    features[`time_center_${index}`] = weight;
  });

  return features;
};

/**
 * Extract features for ML models using FeatureRecord
 */
const extractFeatures = (input: FeatureRecord): FeatureVector => {
  const arriveBeforeMin = getMinutesDelta(
    input.tripStart,
    input.schedDeparture
  );
  const schedDeparturePacificTime = getPacificTime(input.schedDeparture);

  const dayOfWeek = schedDeparturePacificTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Get raw time features and round tiny values to zero
  const timeFeatures = getTimeOfDaySmooth(schedDeparturePacificTime);
  const cleanedTimeFeatures: Record<string, number> = {};
  for (const [key, value] of Object.entries(timeFeatures)) {
    cleanedTimeFeatures[key] = roundTinyValues(value);
  }

  // Running late features
  const runningLate = arriveBeforeMin < input.meanAtDockDuration ? 1 : 0;
  const runningLateMin = Math.max(
    0,
    input.meanAtDockDuration - arriveBeforeMin
  );
  const runningEarlyMin = Math.max(
    0,
    Math.min(arriveBeforeMin - input.meanAtDockDuration, 10)
  );

  // Base features available in both contexts
  const features: FeatureVector = {
    running_late: runningLate,
    running_late_min: runningLateMin,
    running_early_min: runningEarlyMin,
    is_weekend: isWeekend ? 1 : 0,
    prev_delay: input.prevDelay,
    ...cleanedTimeFeatures,
  };

  // Add delay_minutes for arrival models (available in FeatureRecord from prediction)
  if (input.delayMinutes !== undefined) {
    features.delay_minutes = roundTinyValues(input.delayMinutes);
  }

  return features;
};

/**
 * Create training examples for a specific bucket and model type
 */
export const createTrainingExamplesForBucket = (
  bucket: TerminalPairBucket,
  modelType: "arrive-depart" | "depart-arrive"
): TrainingExample[] => {
  const examples: TrainingExample[] = [];

  for (const record of bucket.records) {
    // Since step_2 guarantees data completeness, we can skip validation
    if (modelType === "arrive-depart") {
      examples.push({
        input: extractFeatures(record),
        // biome-ignore lint/style/noNonNullAssertion: step_2 validation guarantees this is not null
        target: record.departureDelay!,
      });
    } else {
      // depart-arrive - atSeaDuration is the only field that might be null
      if (record.atSeaDuration != null) {
        examples.push({
          input: extractFeatures(record),
          target: record.atSeaDuration,
        });
      }
    }
  }

  // Update bucket stats with filtered count
  bucket.bucketStats.filteredRecords = examples.length;

  return examples;
};

/**
 * Extract features for depart-depart model (simplified - no prevDelay)
 */
const extractFeaturesForDepartDepart = (
  record: TrainingDataRecord
): FeatureVector => {
  const schedDeparturePacificTime = getPacificTime(record.schedDeparture);
  const dayOfWeek = schedDeparturePacificTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Get time-of-day features
  const timeFeatures = getTimeOfDaySmooth(schedDeparturePacificTime);
  const cleanedTimeFeatures: Record<string, number> = {};
  for (const [key, value] of Object.entries(timeFeatures)) {
    cleanedTimeFeatures[key] = roundTinyValues(value);
  }

  // Time delta from prevLeftDock to schedDeparture (at-sea duration from A to B)
  const atSeaDurationFromA = getMinutesDelta(
    record.prevLeftDock,
    record.schedDeparture
  );

  // Mean at-sea duration for A-B segment (we'll use meanAtDockDuration as approximation)
  // Note: This is an approximation - ideally we'd have mean at-sea duration for A-B
  const meanAtSeaDurationAB = record.meanAtDockDuration; // Approximation

  const features: FeatureVector = {
    is_weekend: isWeekend ? 1 : 0,
    at_sea_duration_from_a: roundTinyValues(atSeaDurationFromA),
    mean_at_sea_duration_ab: roundTinyValues(meanAtSeaDurationAB),
    ...cleanedTimeFeatures,
  };

  return features;
};

/**
 * Create training examples for arrive-arrive model
 */
const createTrainingExamplesForArriveArrive = (
  bucket: TerminalPairBucket
): TrainingExample[] => {
  const examples: TrainingExample[] = [];

  for (const record of bucket.records) {
    // Uses same features as arrive-depart model
    // Target is total time from arrival at B to arrival at C
    const target = record.atDockDuration + record.atSeaDuration;
    examples.push({
      input: extractFeatures(record),
      target,
    });
  }

  return examples;
};

/**
 * Create training examples for depart-depart model
 */
const createTrainingExamplesForDepartDepart = (
  bucket: TerminalPairBucket
): TrainingExample[] => {
  const examples: TrainingExample[] = [];

  for (const record of bucket.records) {
    // Target is total time from departure at A to departure at B
    // This is the at-sea duration from A to B plus the at-dock duration at B
    const totalTimeFromDepartAtoDepartB = getMinutesDelta(
      record.prevLeftDock,
      record.leftDock
    );
    examples.push({
      input: extractFeaturesForDepartDepart(record),
      target: totalTimeFromDepartAtoDepartB,
    });
  }

  return examples;
};

/**
 * Create training data for all models in a bucket
 */
export const createTrainingDataForBucketAll = (
  bucket: TerminalPairBucket
): {
  arriveDepartExamples: TrainingExample[];
  departArriveExamples: TrainingExample[];
  arriveArriveExamples: TrainingExample[];
  departDepartExamples: TrainingExample[];
} => {
  const arriveDepartExamples = createTrainingExamplesForBucket(
    bucket,
    "arrive-depart"
  );
  const departArriveExamples = createTrainingExamplesForBucket(
    bucket,
    "depart-arrive"
  );
  const arriveArriveExamples = createTrainingExamplesForArriveArrive(bucket);
  const departDepartExamples = createTrainingExamplesForDepartDepart(bucket);

  return {
    arriveDepartExamples,
    departArriveExamples,
    arriveArriveExamples,
    departDepartExamples,
  };
};
