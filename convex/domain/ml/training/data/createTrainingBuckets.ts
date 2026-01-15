// ============================================================================
// ML - TRAINING DATA BUCKETING
// Group training examples by route for specialized model training
// ============================================================================

/**
 * ## Training Data Bucketing Overview
 *
 * This module groups training examples by terminal route to enable specialized
 * model training for each ferry route. Each route has unique characteristics
 * that warrant dedicated ML models.
 *
 * ## Bucketing Strategy
 *
 * - **Unit of Analysis**: Terminal pairs (e.g., "BBI->P52")
 * - **Rationale**: Each route has distinct operational patterns, traffic volumes,
 *   and environmental conditions that affect schedule adherence
 * - **Benefits**: Specialized models capture route-specific behaviors better
 *   than a single global model
 *
 * ## Sampling Logic
 *
 * - **Recency Bias**: Prioritize recent examples (last 720 days)
 * - **Volume Limits**: Cap samples per route to prevent overfitting
 * - **Sorting**: Most recent examples first to capture current patterns
 *
 * ## Quality Controls
 *
 * - Routes with insufficient data are skipped
 * - Sampling prevents memory issues with high-volume routes
 * - Maintains temporal ordering for validation splits
 */

import { config } from "../../shared/config";
import type {
  BucketKey,
  FeatureRecord,
  TrainingBucket,
} from "../../shared/types";

const bucketKeyToString = (key: BucketKey): string => {
  return `pair|${key.pairKey}`;
};

const getBucketKeyForRecord = (record: FeatureRecord): BucketKey => {
  return { bucketType: "pair", pairKey: record.currPairKey };
};

/**
 * Group training records into route-specific buckets for model training.
 *
 * This function organizes feature records by terminal pair (route) and applies
 * sampling to ensure balanced training data across routes.
 *
 * ## Processing Steps
 *
 * 1. **Grouping**: Collect all records for each terminal pair
 * 2. **Sorting**: Order by recency (most recent first) to prioritize current patterns
 * 3. **Sampling**: Limit records per route to prevent overfitting and memory issues
 * 4. **Statistics**: Track total vs sampled counts for analysis
 *
 * ## Sampling Strategy
 *
 * - **Max Samples**: Limited by `config.getMaxSamplesPerRoute()` (prevents domination by high-volume routes)
 * - **Recency Priority**: Recent data more valuable than historical patterns
 * - **Deterministic**: Same input always produces same output
 *
 * ## Output Structure
 *
 * Each bucket contains:
 * - **Bucket Key**: Terminal pair identifier (e.g., "BBI->P52")
 * - **Sampled Records**: Training examples for this route
 * - **Statistics**: Total available vs sampled counts
 *
 * @param records - Feature records ready for training
 * @returns Route-grouped training buckets with sampling applied
 */
export const createTrainingBuckets = (
  records: FeatureRecord[]
): TrainingBucket[] => {
  // Group records by terminal pair for route-specific model training
  const bucketMap = new Map<
    string,
    { key: BucketKey; records: FeatureRecord[] }
  >();

  // Collect all training examples for each route
  for (const record of records) {
    const key = getBucketKeyForRecord(record); // Extract route identifier (B->C pair)
    const mapKey = bucketKeyToString(key); // Create unique string key for Map

    const existing = bucketMap.get(mapKey);
    if (existing) {
      existing.records.push(record);
    } else {
      // Initialize new bucket for this route
      bucketMap.set(mapKey, { key, records: [record] });
    }
  }

  // Process each route bucket with sampling and statistics
  const buckets: TrainingBucket[] = Array.from(bucketMap.values()).map(
    ({ key, records }) => {
      const totalRecords = records.length;

      // Sample most recent records to prioritize current operational patterns
      // Sort by scheduled departure time (descending = most recent first)
      const sampled = records
        .slice()
        .sort((a, b) => b.currScheduledDepartMs - a.currScheduledDepartMs)
        .slice(0, config.getMaxSamplesPerRoute()); // Limit to prevent overfitting

      return {
        bucketKey: key,
        records: sampled,
        bucketStats: {
          totalRecords, // Total examples available for this route
          sampledRecords: sampled.length, // Examples kept after sampling
        },
      };
    }
  );

  // Sort buckets by size (largest first) for processing priority
  buckets.sort((a, b) => b.records.length - a.records.length);

  return buckets;
};
