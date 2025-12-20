// ============================================================================
// STEP 3: BUCKET BY TERMINAL PAIRS
// Group records by terminal pairs and calculate statistics
// ============================================================================

import { VALID_PASSENGER_TERMINALS } from "domain/ml/pipeline/shared/config";
import type { PipelineLogger } from "domain/ml/pipeline/shared/logging";
import type { TerminalPairBucket, TrainingDataRecord } from "domain/ml/types";

/**
 * Create terminal pair buckets from training records
 */
export const createTerminalPairBuckets = (
  records: TrainingDataRecord[],
  logger: PipelineLogger
): TerminalPairBucket[] => {
  logger.logStepStart("createBuckets", { recordCount: records.length });

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

      // Calculate bucket statistics
      const validDelayRecords = records.filter((r) => r.departureDelay != null);
      const validSeaRecords = records.filter((r) => r.atSeaDuration != null);

      const meanDepartureDelay =
        validDelayRecords.length > 0
          ? validDelayRecords.reduce(
              (sum, r) => sum + (r.departureDelay || 0),
              0
            ) / validDelayRecords.length
          : null;

      const meanAtSeaDuration =
        validSeaRecords.length > 0
          ? validSeaRecords.reduce(
              (sum, r) => sum + (r.atSeaDuration || 0),
              0
            ) / validSeaRecords.length
          : null;

      return {
        terminalPair: {
          departingTerminalAbbrev: departing,
          arrivingTerminalAbbrev: arriving,
        },
        records,
        bucketStats: {
          totalRecords: records.length,
          filteredRecords: records.length, // Will be updated in training step
          meanDepartureDelay,
          meanAtSeaDuration,
        },
      };
    }
  );

  // Sort buckets by record count (largest first)
  buckets.sort((a, b) => b.records.length - a.records.length);

  logger.logStepEnd("createBuckets", 0, {
    bucketCount: buckets.length,
    totalRecordsInBuckets: buckets.reduce(
      (sum, b) => sum + b.records.length,
      0
    ),
    largestBucket: buckets[0]
      ? {
          pair: `${buckets[0].terminalPair.departingTerminalAbbrev}_${buckets[0].terminalPair.arrivingTerminalAbbrev}`,
          records: buckets[0].records.length,
        }
      : null,
  });

  return buckets;
};

/**
 * Validate bucket contents
 */
export const validateBuckets = (
  buckets: TerminalPairBucket[],
  logger: PipelineLogger
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
      logger.warn(
        `Invalid bucket: ${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`,
        {
          recordCount: bucket.records.length,
          hasInconsistentRecords: true,
        }
      );
    }
  }

  return { validBuckets, invalidCount };
};
