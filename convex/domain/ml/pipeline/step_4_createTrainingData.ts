// ============================================================================
// STEP 4: CREATE TRAINING DATA
// Feature engineering and training example creation
// ============================================================================

import { extractFeatures } from "domain/ml/pipeline/shared/featureEngineering";
import type {
  TerminalPairBucket,
  TrainingExample,
} from "../types";

/**
 * Create training examples for a specific bucket and model type
 */
export const createTrainingExamplesForBucket = (
  bucket: TerminalPairBucket,
  modelType: "departure" | "arrival"
): TrainingExample[] => {
  const examples: TrainingExample[] = [];

  for (const record of bucket.records) {
    // Since step_2 guarantees data completeness, we can skip validation
    if (modelType === "departure") {
      examples.push({
        input: extractFeatures(record),
        // biome-ignore lint/style/noNonNullAssertion: step_2 validation guarantees this is not null
        target: record.departureDelay!,
      });
    } else {
      // arrival - atSeaDuration is the only field that might be null
      if (record.atSeaDuration != null) {
        examples.push({
          input: extractFeatures(record),
          target: record.atSeaDuration,
        });
      }
    }
  }

  // Update bucket stats with filtered count
  bucket.bucketStats.filteredRecords = examples.length;

  const filterRate = ((examples.length / bucket.records.length) * 100).toFixed(
    1
  );
  console.log(
    `Created ${examples.length}/${bucket.records.length} training examples for ${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev} ${modelType} (${filterRate}%)`
  );

  return examples;
};

/**
 * Create training data for both models in a bucket
 */
export const createTrainingDataForBucketBoth = (
  bucket: TerminalPairBucket
): {
  departureExamples: TrainingExample[];
  arrivalExamples: TrainingExample[];
} => {
  console.log(
    `Creating training data for ${bucket.terminalPair.departingTerminalAbbrev}_${bucket.terminalPair.arrivingTerminalAbbrev} (${bucket.records.length} records)`
  );

  const departureExamples = createTrainingExamplesForBucket(
    bucket,
    "departure"
  );
  const arrivalExamples = createTrainingExamplesForBucket(bucket, "arrival");

  return { departureExamples, arrivalExamples };
};
