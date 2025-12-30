// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 3: BUCKET BY TERMINAL PAIRS
// Group records by terminal pairs and calculate statistics
// ============================================================================

import {
  formatTerminalPairKey,
  PIPELINE_CONFIG,
  parseTerminalPairKey,
} from "../../shared/core/config";
import type {
  TerminalPairBucket,
  TrainingDataRecord,
} from "../../shared/core/types";

/**
 * Create terminal pair buckets from training records
 */
export const createTerminalPairBuckets = (
  records: TrainingDataRecord[]
): TerminalPairBucket[] => {
  console.log(`Creating buckets from ${records.length} records`);

  const bucketMap = new Map<string, TrainingDataRecord[]>();

  // Dynamic grouping by terminal pairs
  // Note: Terminal data already validated
  for (const record of records) {
    const key = formatTerminalPairKey(
      record.DepartingTerminalAbbrev,
      record.ArrivingTerminalAbbrev
    );
    const bucketRecords = bucketMap.get(key) || [];
    bucketRecords.push(record);
    bucketMap.set(key, bucketRecords);
  }

  // Convert to buckets with comprehensive statistics
  const buckets: TerminalPairBucket[] = Array.from(bucketMap.entries()).map(
    ([key, records]) => {
      const [departing, arriving] = parseTerminalPairKey(key);

      // Sample down to most recent MAX_SAMPLES_PER_ROUTE records
      const originalCount = records.length;
      const sampledRecords = records
        .sort((a, b) => b.ScheduledDeparture - a.ScheduledDeparture) // Most recent first
        .slice(0, PIPELINE_CONFIG.MAX_SAMPLES_PER_ROUTE); // Take top N

      console.log(
        `Route ${key}: ${originalCount} → ${sampledRecords.length} samples ` +
          `(kept ${((sampledRecords.length / originalCount) * 100).toFixed(1)}% most recent)`
      );

      // Calculate mean statistics on sampled records
      const validRecords = sampledRecords.filter(
        (r) => r.PrevTripDelay != null && r.AtSeaDuration != null
      );
      const meanDepartureDelay =
        validRecords.length > 0
          ? validRecords.reduce((sum, r) => sum + r.PrevTripDelay!, 0) /
            validRecords.length
          : undefined;
      const meanAtSeaDuration =
        validRecords.length > 0
          ? validRecords.reduce((sum, r) => sum + r.AtSeaDuration!, 0) /
            validRecords.length
          : undefined;
      const meanDelay =
        validRecords.length > 0
          ? validRecords.reduce(
              (sum, r) => sum + r.PrevTripDelay! + r.AtSeaDuration!,
              0
            ) / validRecords.length
          : undefined;

      return {
        terminalPair: {
          departingTerminalAbbrev: departing,
          arrivingTerminalAbbrev: arriving,
        },
        records: sampledRecords,
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
  buckets.sort((a, b) => b.records.length - a.records.length);

  const totalOriginalRecords = buckets.reduce(
    (sum, b) => sum + b.bucketStats.totalRecords,
    0
  );
  const totalSampledRecords = buckets.reduce(
    (sum, b) => sum + b.records.length,
    0
  );
  console.log(
    `Created ${buckets.length} buckets: ${totalOriginalRecords} → ${totalSampledRecords} sampled records ` +
      `(${((totalSampledRecords / totalOriginalRecords) * 100).toFixed(1)}% kept)`
  );

  return buckets;
};
