#!/usr/bin/env tsx

/**
 * Detect outliers in training data for a specific terminal pair
 * Uses multiple statistical methods: IQR, Z-score, and Modified Z-score
 *
 * Applies step_4 filtering logic before outlier detection:
 * - For departure models: includes all records (step_2 guarantees departureDelay is not null)
 * - For arrival models: only includes records where atSeaDuration != null
 *
 * Usage:
 *   tsx scripts/detect-outliers.ts [TERMINAL_PAIR] [MODEL_TYPE]
 *
 * Examples:
 *   tsx scripts/detect-outliers.ts FRH_LOP departure
 *   tsx scripts/detect-outliers.ts FRH_LOP arrival
 *   tsx scripts/detect-outliers.ts FRH_LOP  # defaults to analyzing all fields
 */

import fs from "node:fs";
import path from "node:path";

interface TrainingDataRecord {
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  prevDelay: number;
  tripStart: string;
  leftDock: string;
  tripEnd: string;
  schedDeparture: string;
  departureDelay: number;
  atSeaDuration: number | null;
}

interface TerminalPairBucket {
  terminalPair: {
    departingTerminalAbbrev: string;
    arrivingTerminalAbbrev: string;
  };
  records: TrainingDataRecord[];
}

interface OutlierDetection {
  method: string;
  threshold: number;
  outliers: Array<{
    record: TrainingDataRecord;
    value: number;
    score: number;
  }>;
}

interface Statistics {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
}

/**
 * Calculate basic statistics for a numeric array
 */
const calculateStats = (values: number[]): Statistics => {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  return {
    mean,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1,
    q3,
    iqr,
  };
};

/**
 * Detect outliers using IQR method
 */
const detectOutliersIQR = (
  records: TrainingDataRecord[],
  field: keyof TrainingDataRecord,
  multiplier: number = 1.5
): OutlierDetection => {
  const values = records
    .map((r) => r[field] as number | null)
    .filter((v): v is number => v != null);

  if (values.length === 0) {
    return {
      method: `IQR (${multiplier}x)`,
      threshold: multiplier,
      outliers: [],
    };
  }

  const stats = calculateStats(values);

  const lowerBound = stats.q1 - multiplier * stats.iqr;
  const upperBound = stats.q3 + multiplier * stats.iqr;

  const outliers = records
    .map((record) => {
      const value = record[field] as number | null;
      if (value == null) return null;
      if (value < lowerBound || value > upperBound) {
        return {
          record,
          value,
          score:
            value < lowerBound
              ? (lowerBound - value) / stats.iqr
              : (value - upperBound) / stats.iqr,
        };
      }
      return null;
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return {
    method: `IQR (${multiplier}x)`,
    threshold: multiplier,
    outliers,
  };
};

/**
 * Detect outliers using Z-score method
 */
const detectOutliersZScore = (
  records: TrainingDataRecord[],
  field: keyof TrainingDataRecord,
  threshold: number = 3
): OutlierDetection => {
  const values = records
    .map((r) => r[field] as number | null)
    .filter((v): v is number => v != null);

  if (values.length === 0) {
    return { method: `Z-Score (${threshold}σ)`, threshold, outliers: [] };
  }

  const stats = calculateStats(values);

  const outliers = records
    .map((record) => {
      const value = record[field] as number | null;
      if (value == null) return null;
      const zScore = Math.abs((value - stats.mean) / stats.stdDev);
      if (zScore > threshold) {
        return {
          record,
          value,
          score: zScore,
        };
      }
      return null;
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)
    .sort((a, b) => b.score - a.score);

  return {
    method: `Z-Score (${threshold}σ)`,
    threshold,
    outliers,
  };
};

/**
 * Detect outliers using Modified Z-score (more robust to outliers)
 */
const detectOutliersModifiedZScore = (
  records: TrainingDataRecord[],
  field: keyof TrainingDataRecord,
  threshold: number = 3.5
): OutlierDetection => {
  const values = records
    .map((r) => r[field] as number | null)
    .filter((v): v is number => v != null);

  if (values.length === 0) {
    return {
      method: `Modified Z-Score (${threshold})`,
      threshold,
      outliers: [],
    };
  }

  const stats = calculateStats(values);

  // Calculate median absolute deviation (MAD)
  const deviations = values.map((v) => Math.abs(v - stats.median));
  const mad = calculateStats(deviations).median;
  const modifiedStdDev = mad * 1.4826; // Scale factor for normal distribution

  const outliers = records
    .map((record) => {
      const value = record[field] as number | null;
      if (value == null) return null;
      const modifiedZScore = Math.abs((value - stats.median) / modifiedStdDev);
      if (modifiedZScore > threshold) {
        return {
          record,
          value,
          score: modifiedZScore,
        };
      }
      return null;
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)
    .sort((a, b) => b.score - a.score);

  return {
    method: `Modified Z-Score (${threshold})`,
    threshold,
    outliers,
  };
};

/**
 * Format a date string for display
 */
const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toISOString().replace("T", " ").substring(0, 19);
};

/**
 * Apply underlying data quality filtering (same as step_2 filters)
 * This matches the filtering done in step_2_convertWsfToTraining.ts
 */
const applyDataQualityFiltering = (
  records: TrainingDataRecord[]
): { filtered: TrainingDataRecord[]; filteredOut: number } => {
  const initialCount = records.length;

  // Apply the same filters as step_2:
  // 1. Filter out records where prevDelay < 0
  // 2. Filter out records where atSeaDuration < MIN_DURATION_THRESHOLDS.AT_SEA (2.0 minutes)
  // 3. Filter out records where atDockDuration < MIN_DURATION_THRESHOLDS.AT_DOCK (2.0 minutes)
  const MIN_AT_SEA = 2.0;
  const MIN_AT_DOCK = 2.0;

  const filtered = records.filter((r) => {
    // Filter prevDelay < 0
    if (r.prevDelay < 0) {
      return false;
    }

    // Filter atSeaDuration < 2.0 minutes (if atSeaDuration is not null)
    if (r.atSeaDuration != null && r.atSeaDuration < MIN_AT_SEA) {
      return false;
    }

    // Filter atDockDuration < 2.0 minutes
    // Calculate atDockDuration from tripStart to leftDock
    const tripStart = new Date(r.tripStart).getTime();
    const leftDock = new Date(r.leftDock).getTime();
    const atDockDuration = (leftDock - tripStart) / (1000 * 60); // Convert to minutes
    if (atDockDuration < MIN_AT_DOCK) {
      return false;
    }

    return true;
  });

  const filteredOut = initialCount - filtered.length;
  return { filtered, filteredOut };
};

/**
 * Apply step_4 filtering logic based on model type
 * This matches the filtering done in step_4_createTrainingData.ts
 */
const applyStep4Filtering = (
  records: TrainingDataRecord[],
  modelType: "departure" | "arrival" | "all"
): TrainingDataRecord[] => {
  if (modelType === "all") {
    return records;
  }

  if (modelType === "departure") {
    // For departure models: all records are included
    // (step_2 guarantees departureDelay is not null)
    return records;
  }

  // For arrival models: only include records where atSeaDuration != null
  return records.filter((r) => r.atSeaDuration != null);
};

/**
 * Analyze a terminal pair for outliers
 */
const analyzeTerminalPair = (
  bucket: TerminalPairBucket,
  terminalPair: string,
  modelType: "departure" | "arrival" | "all" = "all"
): void => {
  const allRecords = bucket.records;

  // Apply data quality filtering first (prevDelay < 0)
  const { filtered: qualityFilteredRecords, filteredOut: qualityFilteredOut } =
    applyDataQualityFiltering(allRecords);

  // Apply step_4 filtering
  const filteredRecords = applyStep4Filtering(
    qualityFilteredRecords,
    modelType
  );

  console.log(`\n${"=".repeat(80)}`);
  console.log(`Analyzing: ${terminalPair}`);
  if (modelType !== "all") {
    console.log(`Model Type: ${modelType}`);
  }
  console.log(`Total Records (before filtering): ${allRecords.length}`);
  if (qualityFilteredOut > 0) {
    console.log(
      `Total Records (after underlying data quality filtering): ${qualityFilteredRecords.length}`
    );
    console.log(
      `  (Filtered out ${qualityFilteredOut} records: prevDelay < 0, atSeaDuration < 2.0 min, or atDockDuration < 2.0 min)`
    );
  }
  console.log(
    `Total Records (after step_4 filtering): ${filteredRecords.length}`
  );
  if (modelType === "arrival") {
    const step4FilteredOut =
      qualityFilteredRecords.length - filteredRecords.length;
    if (step4FilteredOut > 0) {
      console.log(
        `  (Filtered out ${step4FilteredOut} records with null atSeaDuration)`
      );
    }
  }
  console.log(`${"=".repeat(80)}\n`);

  if (filteredRecords.length === 0) {
    console.log(`⚠️  No records remaining after filtering. Skipping analysis.`);
    return;
  }

  const records = filteredRecords;

  // Analyze each field based on model type
  const fields: Array<{ name: string; key: keyof TrainingDataRecord }> = [];

  if (modelType === "all" || modelType === "arrival") {
    // Only analyze atSeaDuration if we have valid data (after filtering)
    const hasAtSeaData = records.some((r) => r.atSeaDuration != null);
    if (hasAtSeaData) {
      fields.push({ name: "At Sea Duration", key: "atSeaDuration" });
    }
  }

  if (modelType === "all" || modelType === "departure") {
    fields.push({ name: "Departure Delay", key: "departureDelay" });
  }

  // Always analyze previous delay as it's a feature for both models
  fields.push({ name: "Previous Delay", key: "prevDelay" });

  for (const { name, key } of fields) {
    console.log(`\n${"-".repeat(80)}`);
    console.log(`📊 ${name} Analysis`);
    console.log(`${"-".repeat(80)}`);

    // Filter out null values for fields that might be null
    const values = records
      .map((r) => r[key] as number | null)
      .filter((v): v is number => v != null);

    if (values.length === 0) {
      console.log(`⚠️  No valid values for ${name}. Skipping.`);
      continue;
    }

    const stats = calculateStats(values);

    console.log(`Statistics:`);
    console.log(`  Mean:     ${stats.mean.toFixed(2)}`);
    console.log(`  Median:   ${stats.median.toFixed(2)}`);
    console.log(`  Std Dev:  ${stats.stdDev.toFixed(2)}`);
    console.log(`  Min:      ${stats.min.toFixed(2)}`);
    console.log(`  Max:      ${stats.max.toFixed(2)}`);
    console.log(`  Q1:       ${stats.q1.toFixed(2)}`);
    console.log(`  Q3:       ${stats.q3.toFixed(2)}`);
    console.log(`  IQR:      ${stats.iqr.toFixed(2)}`);

    // Run all detection methods
    const iqrOutliers = detectOutliersIQR(records, key, 1.5);
    const zScoreOutliers = detectOutliersZScore(records, key, 3);
    const modZScoreOutliers = detectOutliersModifiedZScore(records, key, 3.5);

    console.log(`\nOutlier Detection Results:`);
    console.log(
      `  IQR (1.5x):           ${iqrOutliers.outliers.length} outliers`
    );
    console.log(
      `  Z-Score (3σ):         ${zScoreOutliers.outliers.length} outliers`
    );
    console.log(
      `  Modified Z-Score:     ${modZScoreOutliers.outliers.length} outliers`
    );

    // Show top outliers from each method
    const allOutliers = new Map<
      string,
      {
        record: TrainingDataRecord;
        methods: string[];
        scores: { method: string; score: number }[];
      }
    >();

    for (const outlier of iqrOutliers.outliers) {
      const key = `${outlier.record.tripStart}_${outlier.value}`;
      if (!allOutliers.has(key)) {
        allOutliers.set(key, {
          record: outlier.record,
          methods: [],
          scores: [],
        });
      }
      allOutliers.get(key)?.methods.push("IQR");
      allOutliers
        .get(key)
        ?.scores.push({ method: "IQR", score: outlier.score });
    }

    for (const outlier of zScoreOutliers.outliers) {
      const key = `${outlier.record.tripStart}_${outlier.value}`;
      if (!allOutliers.has(key)) {
        allOutliers.set(key, {
          record: outlier.record,
          methods: [],
          scores: [],
        });
      }
      allOutliers.get(key)?.methods.push("Z-Score");
      allOutliers
        .get(key)
        ?.scores.push({ method: "Z-Score", score: outlier.score });
    }

    for (const outlier of modZScoreOutliers.outliers) {
      const key = `${outlier.record.tripStart}_${outlier.value}`;
      if (!allOutliers.has(key)) {
        allOutliers.set(key, {
          record: outlier.record,
          methods: [],
          scores: [],
        });
      }
      allOutliers.get(key)?.methods.push("ModZ");
      allOutliers
        .get(key)
        ?.scores.push({ method: "ModZ", score: outlier.score });
    }

    // Display outliers detected by multiple methods (most suspicious)
    const suspiciousOutliers = Array.from(allOutliers.values())
      .filter((o) => o.methods.length >= 2)
      .sort((a, b) => {
        const maxScoreA = Math.max(...a.scores.map((s) => s.score));
        const maxScoreB = Math.max(...b.scores.map((s) => s.score));
        return maxScoreB - maxScoreA;
      });

    if (suspiciousOutliers.length > 0) {
      console.log(
        `\n🚨 Highly Suspicious Outliers (detected by multiple methods):`
      );
      for (const outlier of suspiciousOutliers.slice(0, 10)) {
        const r = outlier.record;
        const maxScore = Math.max(...outlier.scores.map((s) => s.score));
        console.log(
          `\n  Value: ${(r[key] as number).toFixed(2)} (${outlier.methods.join(", ")}) - Score: ${maxScore.toFixed(2)}`
        );
        console.log(`  Trip Start:    ${formatDate(r.tripStart)}`);
        console.log(`  Scheduled Dep:  ${formatDate(r.schedDeparture)}`);
        console.log(`  Left Dock:      ${formatDate(r.leftDock)}`);
        console.log(`  Trip End:        ${formatDate(r.tripEnd)}`);
        console.log(
          `  At Sea Duration: ${r.atSeaDuration != null ? r.atSeaDuration.toFixed(2) : "null"} min`
        );
        console.log(`  Departure Delay: ${r.departureDelay.toFixed(2)} min`);
        console.log(`  Previous Delay:  ${r.prevDelay.toFixed(2)} min`);
      }
    }

    // Show all outliers from IQR method (most common)
    if (iqrOutliers.outliers.length > 0 && suspiciousOutliers.length === 0) {
      console.log(`\n⚠️  All IQR Outliers:`);
      for (const outlier of iqrOutliers.outliers.slice(0, 10)) {
        const r = outlier.record;
        console.log(
          `\n  Value: ${outlier.value.toFixed(2)} - Score: ${outlier.score.toFixed(2)}`
        );
        console.log(`  Trip Start:    ${formatDate(r.tripStart)}`);
        console.log(
          `  At Sea Duration: ${r.atSeaDuration != null ? r.atSeaDuration.toFixed(2) : "null"} min`
        );
        console.log(`  Departure Delay: ${r.departureDelay.toFixed(2)} min`);
      }
    }
  }
};

/**
 * Main function
 */
const main = (): void => {
  const args = process.argv.slice(2);
  const terminalPair = args[0] || "FRH_LOP";
  const modelTypeArg = args[1]?.toLowerCase();

  let modelType: "departure" | "arrival" | "all" = "all";
  if (modelTypeArg === "departure" || modelTypeArg === "arrival") {
    modelType = modelTypeArg;
  } else if (modelTypeArg && modelTypeArg !== "all") {
    console.warn(`⚠️  Unknown model type: ${modelTypeArg}. Using "all".`);
  }

  console.log(`🔍 Outlier Detection Script`);
  console.log(`Target Terminal Pair: ${terminalPair}`);
  if (modelType !== "all") {
    console.log(`Model Type: ${modelType} (applying step_4 filtering)`);
  } else {
    console.log(`Model Type: all (no step_4 filtering)`);
  }

  const trainingDataPath = path.join(__dirname, "..", "ml", "training-data.json");

  if (!fs.existsSync(trainingDataPath)) {
    console.error(`❌ Training data file not found: ${trainingDataPath}`);
    process.exit(1);
  }

  console.log(`📂 Loading training data from: ${trainingDataPath}`);
  const rawData = fs.readFileSync(trainingDataPath, "utf-8");
  const buckets: TerminalPairBucket[] = JSON.parse(rawData);

  // Find the target terminal pair
  const [departing, arriving] = terminalPair.split("_");
  const bucket = buckets.find(
    (b) =>
      b.terminalPair.departingTerminalAbbrev === departing &&
      b.terminalPair.arrivingTerminalAbbrev === arriving
  );

  if (!bucket) {
    console.error(`❌ Terminal pair not found: ${terminalPair}`);
    console.log(`\nAvailable terminal pairs:`);
    for (const b of buckets) {
      const key = `${b.terminalPair.departingTerminalAbbrev}_${b.terminalPair.arrivingTerminalAbbrev}`;
      console.log(`  - ${key} (${b.records.length} records)`);
    }
    process.exit(1);
  }

  analyzeTerminalPair(bucket, terminalPair, modelType);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`✅ Analysis complete`);
  console.log(`${"=".repeat(80)}\n`);
};

if (require.main === module) {
  main();
}
