// ============================================================================
// STEP 4: CREATE TRAINING DATA
// Feature engineering and training example creation
// ============================================================================

import type {
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingExample,
} from "../types";

/**
 * Extract time-based features common to multiple model types
 *
 * @param record - Training data record to extract features from
 * @returns Time features including weekend indicator and time-of-day features
 */
const timeFeatures = (record: TrainingDataRecord) => ({
  ...record.schedDepartureTimeFeatures,
  isWeekend: record.isWeekend,
});

/**
 * Create training example for arrive-depart-atdock-duration model
 *
 * Predicts how long a vessel will spend at dock after arrival (at-dock duration).
 * Uses arrival context and previous trip metrics as features.
 *
 * @param record - Training data record containing trip information
 * @returns Training example with features and at-dock duration target
 */
export const createArriveDepartTrainingExample = (
  record: TrainingDataRecord
): TrainingExample => ({
  input: {
    ...timeFeatures(record),
    prevDelay: record.prevDelay,
    prevAtSeaDuration: record.prevAtSeaDuration,
    arriveBeforeMinutes: record.arriveBeforeMinutes,
  },
  target: record.currAtDockDuration, // Changed from departureDelay to currAtDockDuration
});

/**
 * Create training example for arrive-depart-delay model
 *
 * Predicts departure delay (how early or late vessel departs relative to schedule).
 * Uses arrival context and previous trip metrics as features.
 *
 * @param record - Training data record containing trip information
 * @returns Training example with features and delay target
 */
export const createArriveDepartLateTrainingExample = (
  record: TrainingDataRecord
): TrainingExample => ({
  input: {
    ...timeFeatures(record),
    prevDelay: record.prevDelay,
    prevAtSeaDuration: record.prevAtSeaDuration,
    arriveBeforeMinutes: record.arriveBeforeMinutes,
  },
  target: record.currDelay,
});

/**
 * Create training example for depart-arrive-atsea-duration model
 *
 * Predicts at-sea duration from departure to arrival using actual at-dock duration
 * and scheduled departure context as features.
 *
 * @param record - Training data record containing trip information
 * @returns Training example with features and at-sea duration target
 */
export const createDepartArriveTrainingExample = (
  record: TrainingDataRecord
): TrainingExample => ({
  input: {
    ...timeFeatures(record),
    atDockDuration: record.currAtDockDuration,
    delay: record.currDelay,
  },
  target: record.currAtSeaDuration,
});

/**
 * Create training example for arrive-arrive-total-duration model
 *
 * Predicts total duration from arrival at dock to arrival at next terminal
 * (combines at-dock and at-sea durations).
 *
 * @param record - Training data record containing trip information
 * @returns Training example with features and total duration target
 */
export const createArriveArriveTrainingExample = (
  record: TrainingDataRecord
): TrainingExample => ({
  input: {
    ...timeFeatures(record),
    prevDelay: record.prevDelay,
    prevAtSeaDuration: record.prevAtSeaDuration,
  },
  target: record.currAtDockDuration + record.currAtSeaDuration,
});

/**
 * Create training example for depart-depart-total-duration model
 *
 * Predicts total duration from departure at terminal A to departure at terminal B
 * using previous trip context as features.
 *
 * @param record - Training data record containing trip information
 * @returns Training example with features and total duration target
 */
export const createDepartDepartTrainingExample = (
  record: TrainingDataRecord
): TrainingExample => ({
  input: {
    ...timeFeatures(record),
    prevDelay: record.prevDelay,
  },
  target: record.prevAtSeaDuration + record.currAtDockDuration,
});

/**
 * Create training examples for a specific model type within a terminal pair bucket
 *
 * Applies the appropriate feature extraction function based on the model type
 * to create training examples from all records in the bucket.
 *
 * @param bucket - Terminal pair bucket containing training records
 * @param modelType - Type of ML model to create training data for
 * @returns Array of training examples for the specified model type
 */
export const createTrainingDataForBucketSingle = (
  bucket: TerminalPairBucket,
  modelType:
    | "arrive-depart-atdock-duration"
    | "depart-arrive-atsea-duration"
    | "arrive-arrive-total-duration"
    | "depart-depart-total-duration"
    | "arrive-depart-delay"
): TrainingExample[] => {
  switch (modelType) {
    case "arrive-depart-atdock-duration":
      return bucket.records.map(createArriveDepartTrainingExample);
    case "depart-arrive-atsea-duration":
      return bucket.records.map(createDepartArriveTrainingExample);
    case "arrive-arrive-total-duration":
      return bucket.records.map(createArriveArriveTrainingExample);
    case "depart-depart-total-duration":
      return bucket.records.map(createDepartDepartTrainingExample);
    case "arrive-depart-delay":
      return bucket.records.map(createArriveDepartLateTrainingExample);
  }
};
