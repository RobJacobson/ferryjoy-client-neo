// ============================================================================
// STEP 3: BUCKET BY TERMINAL PAIRS
// Group records by terminal pairs and calculate statistics
// ============================================================================

import { VALID_PASSENGER_TERMINALS } from "domain/ml/pipeline/shared/config";
import type { TerminalPairBucket, TrainingDataRecord } from "domain/ml/types";

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

      return {
        terminalPair: {
          departingTerminalAbbrev: departing,
          arrivingTerminalAbbrev: arriving,
        },
        records,
        bucketStats: {
          totalRecords: records.length,
          filteredRecords: records.length, // Will be updated in training step
        },
      };
    }
  );

  // Sort buckets by record count (largest first)
  buckets.sort((a, b) => b.records.length - a.records.length);

  const totalRecords = buckets.reduce((sum, b) => sum + b.records.length, 0);
  console.log(
    `Created ${buckets.length} buckets with ${totalRecords} total records`
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
