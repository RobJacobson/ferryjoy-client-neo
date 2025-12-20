// ============================================================================
// DATA VALIDATION UTILITIES
// ============================================================================

import type { TerminalPairBucket, TrainingDataRecord } from "domain/ml/types";

/**
 * Validate a training data record
 */
export const validateTrainingRecord = (record: TrainingDataRecord): boolean => {
  // Required fields check
  if (
    !record.departingTerminalAbbrev ||
    !record.arrivingTerminalAbbrev ||
    !record.tripStart ||
    !record.leftDock ||
    !record.tripEnd ||
    !record.scheduledDeparture
  ) {
    return false;
  }

  // Terminal validation
  const VALID_PASSENGER_TERMINALS = new Set([
    "ANA",
    "BBI",
    "BRE",
    "CLI",
    "COU",
    "EDM",
    "FAU",
    "FRH",
    "KIN",
    "LOP",
    "MUK",
    "ORI",
    "P52",
    "POT",
    "PTD",
    "SHI",
    "SID",
    "SOU",
    "TAH",
    "VAI",
  ]);

  if (
    !VALID_PASSENGER_TERMINALS.has(record.departingTerminalAbbrev) ||
    !VALID_PASSENGER_TERMINALS.has(record.arrivingTerminalAbbrev)
  ) {
    return false;
  }

  // Temporal consistency check
  if (
    record.tripStart >= record.leftDock ||
    record.leftDock >= record.tripEnd
  ) {
    return false;
  }

  return true;
};

/**
 * Validate a terminal pair bucket
 */
export const validateBucket = (
  bucket: TerminalPairBucket
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (bucket.records.length === 0) {
    errors.push("Bucket contains no records");
  }

  if (bucket.bucketStats.totalRecords !== bucket.records.length) {
    errors.push("Bucket stats totalRecords doesn't match actual record count");
  }

  // Check if all records are valid
  const invalidRecords = bucket.records.filter(
    (r) => !validateTrainingRecord(r)
  );
  if (invalidRecords.length > 0) {
    errors.push(`${invalidRecords.length} invalid records in bucket`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate pipeline configuration
 */
export const validatePipelineConfig = (
  config: Record<string, unknown>
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (
    !config.batchSize ||
    typeof config.batchSize !== "number" ||
    config.batchSize <= 0
  ) {
    errors.push("Invalid batch size");
  }

  if (
    !config.minTrainingExamples ||
    typeof config.minTrainingExamples !== "number" ||
    config.minTrainingExamples < 0
  ) {
    errors.push("Invalid minimum training examples");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
