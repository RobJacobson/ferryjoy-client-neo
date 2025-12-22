// ============================================================================
// MODEL TRAINING COORDINATOR
// Orchestrates model training across terminal pair buckets
// ============================================================================

import type { ModelParameters, TerminalPairBucket } from "../../types";
import { trainModelsForBucket } from "../step_6_trainBuckets";

/**
 * Train models for all buckets sequentially
 */
export const trainAllBuckets = async (
  buckets: TerminalPairBucket[]
): Promise<ModelParameters[]> => {
  const allModels: ModelParameters[] = [];

  console.log(`Training models for ${buckets.length} buckets`);

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const pairKey = `${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev}`;

    try {
      console.log(
        `Training bucket ${i + 1}/${buckets.length}: ${pairKey} (${bucket.records.length} records)`
      );
      const bucketModels = await trainModelsForBucket(bucket);
      allModels.push(...bucketModels);
    } catch (error) {
      console.error(`Failed to train models for ${pairKey}:`, error);
      // Continue with other buckets - don't fail the entire pipeline
    }
  }

  console.log(
    `Completed training: ${allModels.length} models created from ${buckets.length} buckets`
  );
  return allModels;
};
