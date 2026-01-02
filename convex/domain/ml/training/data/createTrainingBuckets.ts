// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 3: BUCKET BY TERMINAL PAIRS
// Group records by terminal pairs and calculate statistics
// ============================================================================

import type {
  TerminalPairBucket,
  TrainingDataWithTerminals,
} from "domain/ml/shared/types";
import {
  config,
  formatTerminalPairKey,
  parseTerminalPairKey,
} from "../../shared/config";

/**
 * Create terminal pair buckets from training records
 */
export const createTerminalPairBuckets = (
  records: TrainingDataWithTerminals[]
): TerminalPairBucket[] => {
  console.log(`Creating buckets from ${records.length} records`);

  const bucketMap = new Map<string, TrainingDataWithTerminals[]>();

  // Dynamic grouping by terminal pairs
  // Note: Terminal data already validated
  for (const record of records) {
    const key = formatTerminalPairKey(
      record.terminalPair.departingTerminalAbbrev,
      record.terminalPair.arrivingTerminalAbbrev
    );
    const bucketRecords = bucketMap.get(key) || [];
    bucketRecords.push(record);
    bucketMap.set(key, bucketRecords);
  }

  /**
   * Extract Features from TrainingDataWithTerminals for model processing
   */
  const recordToFeatures = (
    record: TrainingDataWithTerminals
  ): typeof record.features => record.features;

  // Convert to buckets with comprehensive statistics
  const buckets: TerminalPairBucket[] = Array.from(bucketMap.entries()).map(
    ([key, records]) => {
      const [departing, arriving] = parseTerminalPairKey(key);

      // Sample down to most recent MAX_SAMPLES_PER_ROUTE records
      const originalCount = records.length;
      const sampledRecords = records
        .sort((a, b) => b.scheduledDeparture - a.scheduledDeparture) // Most recent first
        .slice(0, config.getMaxSamplesPerRoute()); // Take top N

      // Calculate mean statistics on sampled records
      const validRecords = sampledRecords.filter(
        (r) =>
          r.features.prevTripDelay != null && r.features.atSeaDuration != null
      );
      const meanDepartureDelay =
        validRecords.length > 0
          ? validRecords.reduce(
              (sum, r) => sum + r.features.prevTripDelay!,
              0
            ) / validRecords.length
          : undefined;
      const meanAtSeaDuration =
        validRecords.length > 0
          ? validRecords.reduce(
              (sum, r) => sum + r.features.atSeaDuration!,
              0
            ) / validRecords.length
          : undefined;
      const meanDelay =
        validRecords.length > 0
          ? validRecords.reduce(
              (sum, r) =>
                sum + r.features.prevTripDelay! + r.features.atSeaDuration!,
              0
            ) / validRecords.length
          : undefined;

      // Convert records to features for the bucket
      const features = sampledRecords.map(recordToFeatures);

      return {
        terminalPair: {
          departingTerminalAbbrev: departing,
          arrivingTerminalAbbrev: arriving,
        },
        features,
        bucketStats: {
          totalRecords: originalCount, // Original count before sampling
          filteredRecords: sampledRecords.length, // Actual training samples
          meanDepartureDelay,
          meanAtSeaDuration,
          meanDelay,
        },
      };
    }
  );

  // Sort buckets by sampled record count (largest first)
  buckets.sort((a, b) => b.features.length - a.features.length);

  const totalOriginalRecords = buckets.reduce(
    (sum, b) => sum + b.bucketStats.totalRecords,
    0
  );
  const totalSampledRecords = buckets.reduce(
    (sum, b) => sum + b.features.length,
    0
  );
  console.log(
    `Created ${buckets.length} buckets: ${totalOriginalRecords} → ${totalSampledRecords} sampled records ` +
      `(${((totalSampledRecords / totalOriginalRecords) * 100).toFixed(1)}% kept)`
  );

  return buckets;
};
