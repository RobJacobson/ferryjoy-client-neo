/**
 * ML input outlier audit.
 *
 * This script replays the existing ML training pipeline's *input* processing:
 * - Fetch WSF VesselHistory data (optionally unsampled)
 * - Build training windows + feature records
 * - For each terminal pair and each model type, find the 3 lowest + 3 highest
 *   target values (extremes) and write them to JSON files.
 *
 * Output:
 * - `ml/outliers/<PAIR_KEY>/<MODEL_TYPE>.json`
 *
 * Usage:
 * - `bun run ml:audit-outliers`
 * - `bunx tsx scripts/ml/audit-outlier-inputs.ts`
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFeatureRecords } from "../../convex/domain/ml/shared/featureRecord";
import { models } from "../../convex/domain/ml/shared/models";
import type {
  FeatureRecord,
  ModelType,
  TerminalPairKey,
} from "../../convex/domain/ml/shared/types";
import { MODEL_KEYS } from "../../convex/domain/ml/shared/types";
import { createTrainingBuckets } from "../../convex/domain/ml/training/data/createTrainingBuckets";
import { createTrainingWindows } from "../../convex/domain/ml/training/data/createTrainingWindows";
import { loadWsfTrainingData } from "../../convex/domain/ml/training/data/loadTrainingData";

// ============================================================================
// Types
// ============================================================================

type OutlierEntry = {
  targetMinutes: number;
  currScheduledDepartMs: number;
  featureRecord: DiagnosticFeatureRecord;
};

type OutlierFile = {
  pairKey: TerminalPairKey;
  modelType: ModelType;
  generatedAt: string;
  counts: {
    recordsInPair: number;
    nonNullTargets: number;
    meanTarget: number | null;
    skippedRecords: number;
  };
  lowest: OutlierEntry[];
  highest: OutlierEntry[];
};

type TargetKey = keyof FeatureRecord["targets"];

type DiagnosticFeatureRecord = Omit<FeatureRecord, "features" | "targets"> & {
  features: {
    atDock?: FeatureRecord["features"]["atDock"];
    atSea?: FeatureRecord["features"]["atSea"];
  };
  target: { key: TargetKey; minutes: number };
};

// ============================================================================
// Main
// ============================================================================

const OUTPUT_ROOT = path.join(process.cwd(), "ml", "outliers");
const OUTLIERS_PER_SIDE = 3;

async function main(): Promise<void> {
  console.log("ML outlier audit: loading WSF VesselHistory (unsampled)...");
  const wsfRecords = await loadWsfTrainingData({ sampleRecords: false });
  console.log("Loaded WSF records.", { records: wsfRecords.length });

  console.log("Building training windows...");
  const windows = createTrainingWindows(wsfRecords);
  console.log("Built training windows.", { windows: windows.length });

  console.log("Building feature records...");
  const featureRecords = createFeatureRecords(windows);
  console.log("Built feature records.", {
    featureRecords: featureRecords.length,
  });

  console.log("Grouping feature records by terminal pair (no sampling)...");
  const buckets = createTrainingBuckets(featureRecords, {
    sampleRecords: false,
  });
  console.log("Buckets ready.", { buckets: buckets.length });

  console.log("Preparing output folder (overwrite)...");
  await rm(OUTPUT_ROOT, { recursive: true, force: true });
  await mkdir(OUTPUT_ROOT, { recursive: true });

  let filesWritten = 0;
  for (const bucket of buckets) {
    const pairKey = bucket.bucketKey.pairKey;
    const pairDir = path.join(OUTPUT_ROOT, pairKey);
    await mkdir(pairDir, { recursive: true });

    for (const modelType of MODEL_KEYS) {
      const { lowest, highest, nonNullTargets, sumTargets } =
        findOutliersForModel(bucket.records, modelType);

      const meanTarget =
        nonNullTargets > 0
          ? Math.round((sumTargets / nonNullTargets) * 100) / 100
          : null;
      const skippedRecords = bucket.records.length - nonNullTargets;

      const payload: OutlierFile = {
        pairKey,
        modelType,
        generatedAt: new Date().toISOString(),
        counts: {
          recordsInPair: bucket.records.length,
          nonNullTargets,
          meanTarget,
          skippedRecords,
        },
        lowest,
        highest,
      };

      const filePath = path.join(pairDir, `${modelType}.json`);
      await writeFile(filePath, safeJsonStringify(payload), "utf8");
      filesWritten += 1;
    }
  }

  console.log("Outlier audit complete.", {
    outputRoot: OUTPUT_ROOT,
    filesWritten,
  });
}

// ============================================================================
// Outlier selection
// ============================================================================

const findOutliersForModel = (
  records: FeatureRecord[],
  modelType: ModelType
) => {
  const calculateTarget = models[modelType].calculateTarget;

  let nonNullTargets = 0;
  let sumTargets = 0;
  const lowest: OutlierEntry[] = [];
  const highest: OutlierEntry[] = [];

  for (const record of records) {
    const targetMinutes = calculateTarget(record);
    if (targetMinutes == null) {
      continue;
    }

    nonNullTargets += 1;
    sumTargets += targetMinutes;
    const entry: OutlierEntry = {
      targetMinutes,
      currScheduledDepartMs: record.currScheduledDepartMs,
      featureRecord: toDiagnosticFeatureRecord(record, modelType),
    };

    insertIntoLowest(lowest, entry, OUTLIERS_PER_SIDE);
    insertIntoHighest(highest, entry, OUTLIERS_PER_SIDE);
  }

  return { lowest, highest, nonNullTargets, sumTargets };
};

/**
 * Create a JSON-friendly representation of a FeatureRecord for diagnostics.
 *
 * Includes only the feature set appropriate for the model type:
 * - `at-dock-*` models include `features.atDock` only
 * - `at-sea-*` models include `features.atSea` only
 *
 * @param record - Full feature record from the ML pipeline
 * @param modelType - Model type determining which feature set is relevant
 * @returns Feature record with only the relevant feature bundle included
 */
const toDiagnosticFeatureRecord = (
  record: FeatureRecord,
  modelType: ModelType
): DiagnosticFeatureRecord => {
  const isAtDock = modelType.startsWith("at-dock-");
  const targetKey = getTargetKeyForModel(modelType);
  return {
    currPairKey: record.currPairKey,
    currScheduledDepartMs: record.currScheduledDepartMs,
    isEligibleForDepartC: record.isEligibleForDepartC,
    features: isAtDock
      ? { atDock: record.features.atDock }
      : { atSea: record.features.atSea },
    target: { key: targetKey, minutes: record.targets[targetKey] },
    prevHistory: record.prevHistory,
    currHistory: record.currHistory,
    nextHistory: record.nextHistory,
  };
};

/**
 * Map each model type to the specific target key it uses.
 *
 * @param modelType - Model type
 * @returns Target key used by that model type
 */
const getTargetKeyForModel = (modelType: ModelType): TargetKey => {
  switch (modelType) {
    case "at-dock-depart-curr":
      return "departCurrMinutes";
    case "at-dock-arrive-next":
      return "arriveNextFromCurrScheduledMinutes";
    case "at-sea-arrive-next":
      return "arriveNextFromCurrActualMinutes";
    case "at-dock-depart-next":
    case "at-sea-depart-next":
      return "departNextFromNextScheduledMinutes";
  }
};

/**
 * Keep the K smallest entries (ascending by target, tie by currScheduledDepartMs).
 *
 * @param arr - Current smallest-K array (mutated in-place)
 * @param entry - Candidate entry
 * @param k - Max size to keep
 */
const insertIntoLowest = (
  arr: OutlierEntry[],
  entry: OutlierEntry,
  k: number
) => {
  const idx = arr.findIndex((e) => compareAscending(entry, e) < 0);
  if (idx === -1) {
    arr.push(entry);
  } else {
    arr.splice(idx, 0, entry);
  }
  if (arr.length > k) {
    arr.pop();
  }
};

/**
 * Keep the K largest entries (descending by target, tie by currScheduledDepartMs).
 *
 * @param arr - Current largest-K array (mutated in-place)
 * @param entry - Candidate entry
 * @param k - Max size to keep
 */
const insertIntoHighest = (
  arr: OutlierEntry[],
  entry: OutlierEntry,
  k: number
) => {
  const idx = arr.findIndex((e) => compareDescending(entry, e) < 0);
  if (idx === -1) {
    arr.push(entry);
  } else {
    arr.splice(idx, 0, entry);
  }
  if (arr.length > k) {
    arr.pop();
  }
};

/**
 * Sort order: targetMinutes asc, then currScheduledDepartMs asc.
 *
 * @param a - First entry
 * @param b - Second entry
 * @returns Negative if a comes before b
 */
const compareAscending = (a: OutlierEntry, b: OutlierEntry): number => {
  if (a.targetMinutes !== b.targetMinutes) {
    return a.targetMinutes - b.targetMinutes;
  }
  return a.currScheduledDepartMs - b.currScheduledDepartMs;
};

/**
 * Sort order: targetMinutes desc, then currScheduledDepartMs asc.
 *
 * @param a - First entry
 * @param b - Second entry
 * @returns Negative if a comes before b
 */
const compareDescending = (a: OutlierEntry, b: OutlierEntry): number => {
  if (a.targetMinutes !== b.targetMinutes) {
    return b.targetMinutes - a.targetMinutes;
  }
  return a.currScheduledDepartMs - b.currScheduledDepartMs;
};

// ============================================================================
// JSON helpers
// ============================================================================

/**
 * Safely stringify objects that may contain Dates or bigints.
 *
 * @param value - Value to stringify
 * @returns Pretty JSON (2 spaces) suitable for IDE viewing
 */
const safeJsonStringify = (value: unknown): string => {
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") {
        return String(v);
      }
      if (typeof v === "number") {
        // Keep integer IDs/timestamps intact; round only fractional values.
        if (!Number.isFinite(v) || Number.isInteger(v)) {
          return v;
        }
        return Math.round(v * 100) / 100;
      }
      return v;
    },
    2
  );
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
