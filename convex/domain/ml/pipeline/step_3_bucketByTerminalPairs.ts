// ============================================================================
// STEP 3: BUCKET BY TERMINAL PAIRS
// Group records by terminal pairs and calculate statistics
// ============================================================================

import { VALID_PASSENGER_TERMINALS, PIPELINE_CONFIG } from "./shared/config";
import type { TerminalPairBucket, TrainingDataRecord } from "../types";

/**
 * Create terminal pair buckets from training records
 */
export const createTerminalPairBuckets = (
  records: TrainingDataRecord[]
): TerminalPairBucket[] => {
  console.log(`Creating buckets from ${records.length} records`);

  const bucketMap = new Map<string, TrainingDataRecord[]>();

  // Dynamic grouping by terminal pairs
  for (const record of records) {
    // Additional validation (should already be filtered, but being safe)
    if (
      !VALID_PASSENGER_TERMINALS.has(record.departingTerminalAbbrev) ||
      !VALID_PASSENGER_TERMINALS.has(record.arrivingTerminalAbbrev)
    ) {
      continue;
    }

    const key = `${record.departingTerminalAbbrev}_${record.arrivingTerminalAbbrev}`;
    const bucketRecords = bucketMap.get(key) || [];
    bucketRecords.push(record);
    bucketMap.set(key, bucketRecords);
  }

  // Convert to buckets with comprehensive statistics
  const buckets: TerminalPairBucket[] = Array.from(bucketMap.entries()).map(
    ([key, records]) => {
      const [departing, arriving] = key.split("_");

      // Sample down to most recent MAX_SAMPLES_PER_ROUTE records
      const originalCount = records.length;
      const sampledRecords = records
        .sort((a, b) => b.tripStart.getTime() - a.tripStart.getTime()) // Most recent first
        .slice(0, PIPELINE_CONFIG.MAX_SAMPLES_PER_ROUTE); // Take top N

      console.log(
        `Route ${key}: ${originalCount} → ${sampledRecords.length} samples ` +
        `(kept ${((sampledRecords.length / originalCount) * 100).toFixed(1)}% most recent)`
      );

      // Calculate mean statistics on sampled records
      const validRecords = sampledRecords.filter(r => r.departureDelay != null && r.atSeaDuration != null);
      const meanDepartureDelay = validRecords.length > 0
        ? validRecords.reduce((sum, r) => sum + r.departureDelay!, 0) / validRecords.length
        : undefined;
      const meanAtSeaDuration = validRecords.length > 0
        ? validRecords.reduce((sum, r) => sum + r.atSeaDuration!, 0) / validRecords.length
        : undefined;
      const meanDelay = validRecords.length > 0
        ? validRecords.reduce((sum, r) => sum + r.departureDelay! + r.atSeaDuration!, 0) / validRecords.length
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

  const totalOriginalRecords = buckets.reduce((sum, b) => sum + b.bucketStats.totalRecords, 0);
  const totalSampledRecords = buckets.reduce((sum, b) => sum + b.records.length, 0);
  console.log(
    `Created ${buckets.length} buckets: ${totalOriginalRecords} → ${totalSampledRecords} sampled records ` +
    `(${((totalSampledRecords / totalOriginalRecords) * 100).toFixed(1)}% kept)`
  );

  return buckets;
};

/**
 * Validate bucket contents
 */
export const validateBuckets = (
  buckets: TerminalPairBucket[]
): { validBuckets: TerminalPairBucket[]; invalidCount: number } => {
  const validBuckets: TerminalPairBucket[] = [];
  let invalidCount = 0;

  for (const bucket of buckets) {
    const isValid =
      bucket.records.length > 0 &&
      bucket.records.every(
        (r) =>
          r.departingTerminalAbbrev ===
            bucket.terminalPair.departingTerminalAbbrev &&
          r.arrivingTerminalAbbrev ===
            bucket.terminalPair.arrivingTerminalAbbrev
      );

    if (isValid) {
      validBuckets.push(bucket);
    } else {
      invalidCount++;
      console.warn(
        `Invalid bucket: ${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev} (${bucket.records.length} records)`
      );
    }
  }

  return { validBuckets, invalidCount };
};
