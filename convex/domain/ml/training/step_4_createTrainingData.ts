// ============================================================================
// STEP 4: CREATE TRAINING DATA
// Feature engineering and training example creation
// ============================================================================

import type {
  TerminalPairBucket,
  TrainingDataRecord,
  TrainingExample,
} from "../types";

const timeFeatures = (record: TrainingDataRecord) => ({
  ...record.schedDepartureTimeFeatures,
  isWeekend: record.isWeekend,
});

/**
 * Create training example for arrive-depart-atdock-duration model
 * Returns null if the record should be skipped, otherwise returns the training example
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
 * Predicts how early the vessel arrives at the dock (in minutes)
 * Returns null if the record should be skipped, otherwise returns the training example
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
 * Returns null if the record should be skipped, otherwise returns the training example
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
 * Returns null if the record should be skipped, otherwise returns the training example
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
 * Returns null if the record should be skipped, otherwise returns the training example
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
 * Create training data for a single model type in a bucket
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
