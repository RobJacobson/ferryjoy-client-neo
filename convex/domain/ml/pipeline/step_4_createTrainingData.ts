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
 * Create training example for arrive-depart model
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
 * Create training example for arrive-depart-late model
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
 * Create training example for depart-arrive model
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
 * Create training example for arrive-arrive model
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
 * Create training example for depart-depart model
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
    | "arrive-depart"
    | "depart-arrive"
    | "arrive-arrive"
    | "depart-depart"
    | "arrive-depart-late"
): TrainingExample[] => {
  switch (modelType) {
    case "arrive-depart":
      return bucket.records.map(createArriveDepartTrainingExample);
    case "depart-arrive":
      return bucket.records.map(createDepartArriveTrainingExample);
    case "arrive-arrive":
      return bucket.records.map(createArriveArriveTrainingExample);
    case "depart-depart":
      return bucket.records.map(createDepartDepartTrainingExample);
    case "arrive-depart-late":
      return bucket.records.map(createArriveDepartLateTrainingExample);
  }
};
