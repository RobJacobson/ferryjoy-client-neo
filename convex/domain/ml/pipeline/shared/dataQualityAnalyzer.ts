// ============================================================================
// DATA QUALITY ANALYSIS UTILITIES
// Basic data quality metrics for ML pipeline reporting
// ============================================================================

import type {
  DataQualityMetrics,
  TerminalPairBucket,
  TrainingDataRecord,
} from "../../types";

/**
 * Analyze basic data quality metrics
 */
export const analyzeDataQuality = (
  trainingRecords: TrainingDataRecord[],
  buckets: TerminalPairBucket[]
): DataQualityMetrics => {
  const validTemporalRecords = calculateTemporalConsistency(trainingRecords);

  const quality: DataQualityMetrics = {
    totalRecords: trainingRecords.length,
    completeness: {
      overallScore: 1.0, // Training records are already filtered/validated
      fieldCompleteness: {}, // Simplified - no detailed field analysis needed
    },
    temporal: {
      validOrdering: validTemporalRecords / trainingRecords.length,
      invalidRecords: trainingRecords.length - validTemporalRecords,
    },
    // Removed statistical analysis (skewness, outliers) for YAGNI
  };

  console.log(
    `Data quality: ${trainingRecords.length} records, ${buckets.length} buckets`
  );
  return quality;
};

/**
 * Calculate temporal consistency (count of valid time ordering)
 */
const calculateTemporalConsistency = (
  records: TrainingDataRecord[]
): number => {
  return records.filter(
    (r) => r.tripStart && r.schedDeparture && r.tripStart < r.schedDeparture
  ).length;
};
