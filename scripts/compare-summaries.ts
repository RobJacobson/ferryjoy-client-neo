import * as fs from "node:fs";
import { writeFileSync } from "node:fs";
import * as path from "node:path";

type BucketType = "chain" | "pair";

type TrainingResultRow = {
  bucket_type: BucketType;
  bucket_key: string;

  at_dock_depart_curr_mae?: number;
  at_dock_depart_curr_r2?: number;
  at_dock_depart_curr_rmse?: number;
  at_dock_depart_curr_stddev?: number;

  at_dock_arrive_next_mae?: number;
  at_dock_arrive_next_r2?: number;
  at_dock_arrive_next_rmse?: number;
  at_dock_arrive_next_stddev?: number;

  at_dock_depart_next_mae?: number;
  at_dock_depart_next_r2?: number;
  at_dock_depart_next_rmse?: number;
  at_dock_depart_next_stddev?: number;

  at_sea_arrive_next_mae?: number;
  at_sea_arrive_next_r2?: number;
  at_sea_arrive_next_rmse?: number;
  at_sea_arrive_next_stddev?: number;

  at_sea_depart_next_mae?: number;
  at_sea_depart_next_r2?: number;
  at_sea_depart_next_rmse?: number;
  at_sea_depart_next_stddev?: number;

  total_records: number;
  sampled_records: number;
  created_at: string;
};

type ModelKey =
  | "at_dock_depart_curr"
  | "at_dock_arrive_next"
  | "at_dock_depart_next"
  | "at_sea_arrive_next"
  | "at_sea_depart_next";

type MetricKey = "mae" | "r2" | "stddev";

type ComparisonRow = {
  bucket_type: BucketType;
  bucket_key: string;
  total_records: number;
  metrics: Record<
    ModelKey,
    {
      mae_a?: number;
      mae_b?: number;
      mae_diff?: number;
      r2_a?: number;
      r2_b?: number;
      r2_diff?: number;
      stddev_a?: number;
      stddev_b?: number;
      stddev_diff?: number;
    }
  >;
};

const parseCSV = (content: string): TrainingResultRow[] => {
  const lines = content.trim().split("\n");
  const headers = lines[0]?.split(",") ?? [];

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string | number | undefined> = {};

    headers.forEach((header, index) => {
      const value = values[index];
      if (value === "" || value === undefined) {
        row[header] = undefined;
        return;
      }

      if (
        header.endsWith("_mae") ||
        header.endsWith("_r2") ||
        header.endsWith("_rmse") ||
        header.endsWith("_stddev") ||
        header.endsWith("_records")
      ) {
        row[header] = parseFloat(value);
        return;
      }

      row[header] = value;
    });

    return row as unknown as TrainingResultRow;
  });
};

const getMetric = (
  row: TrainingResultRow,
  modelKey: ModelKey,
  metric: MetricKey
): number | undefined => {
  const key = `${modelKey}_${metric}` as keyof TrainingResultRow;
  return row[key] as number | undefined;
};

const calcDiff = (a?: number, b?: number) =>
  a != null && b != null ? b - a : undefined;

const shouldSkip = (
  rowA: TrainingResultRow,
  rowB: TrainingResultRow,
  showAll: boolean = false
) => {
  if (!showAll) {
    if (rowA.total_records < 100 || rowB.total_records < 100) {
      return true;
    }

    // Exclude noisy terminals/buckets from reports.
    const excluded = ["ANA", "FRH", "LOP", "SHI"] as const;
    const keyA = rowA.bucket_key;
    const keyB = rowB.bucket_key;
    if (
      excluded.some((t) => keyA.includes(t) || keyB.includes(t)) ||
      keyA.includes("ORI") ||
      keyB.includes("ORI")
    ) {
      return true;
    }
  }

  return false;
};

const compareResults = (
  fileAData: TrainingResultRow[],
  fileBData: TrainingResultRow[],
  showAll: boolean = false
): ComparisonRow[] => {
  const fileBMap = new Map(
    fileBData.map((row) => [`${row.bucket_type}|${row.bucket_key}`, row])
  );

  const modelKeys: ModelKey[] = [
    "at_dock_depart_curr",
    "at_dock_arrive_next",
    "at_dock_depart_next",
    "at_sea_arrive_next",
    "at_sea_depart_next",
  ];

  const comparison: ComparisonRow[] = [];

  for (const rowA of fileAData) {
    const rowB = fileBMap.get(`${rowA.bucket_type}|${rowA.bucket_key}`);
    if (!rowB) {
      continue;
    }

    if (shouldSkip(rowA, rowB, showAll)) {
      continue;
    }

    const metrics = modelKeys.reduce(
      (acc, modelKey) => {
        const maeA = getMetric(rowA, modelKey, "mae");
        const maeB = getMetric(rowB, modelKey, "mae");
        const r2A = getMetric(rowA, modelKey, "r2");
        const r2B = getMetric(rowB, modelKey, "r2");
        const stddevA = getMetric(rowA, modelKey, "stddev");
        const stddevB = getMetric(rowB, modelKey, "stddev");

        acc[modelKey] = {
          mae_a: maeA,
          mae_b: maeB,
          mae_diff: calcDiff(maeA, maeB),
          r2_a: r2A,
          r2_b: r2B,
          r2_diff: calcDiff(r2A, r2B),
          stddev_a: stddevA,
          stddev_b: stddevB,
          stddev_diff: calcDiff(stddevA, stddevB),
        };
        return acc;
      },
      {} as ComparisonRow["metrics"]
    );

    comparison.push({
      bucket_type: rowA.bucket_type,
      bucket_key: rowA.bucket_key,
      total_records: rowA.total_records,
      metrics,
    });
  }

  return comparison;
};

const generateMarkdown = (comparison: ComparisonRow[]): string => {
  let markdown = `# Training Results Comparison: first vs second

Comparing model performance between **first** and **second**.

**Interpretation**
- Positive MAE diff = second is worse (higher error)
- Negative MAE diff = second is better (lower error)
- Positive R² diff = second is better (higher explanatory power)
- Negative R² diff = second is worse (lower explanatory power)
- Positive SD diff = second is less consistent (more variable errors)
- Negative SD diff = second is more consistent (less variable errors)

`;

  const formatNum = (num?: number) => (num != null ? num.toFixed(3) : "N/A");
  const formatDiff = (diff?: number) => {
    if (diff == null) return "N/A";
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff.toFixed(3)}`;
  };

  const BASE_COLS = {
    bucket: 14,
    maeA: 12,
    maeB: 13,
    maeDiff: 9,
    r2A: 11,
    r2B: 13,
    r2Diff: 8,
    stddevA: 11,
    stddevB: 12,
    stddevDiff: 11,
    records: 7,
  } as const;

  const cols: Record<keyof typeof BASE_COLS, number> = { ...BASE_COLS };

  const maeALabel = `MAE (first)`;
  const maeBLabel = `MAE (second)`;
  const r2ALabel = `R² (first)`;
  const r2BLabel = `R² (second)`;
  const stddevALabel = `SD (first)`;
  const stddevBLabel = `SD (second)`;

  const pad = (value: string, width: number, align: "left" | "right") =>
    align === "right" ? value.padStart(width) : value.padEnd(width);

  const dashed = (width: number) => "-".repeat(width);

  const models: Array<{ key: ModelKey; title: string }> = [
    {
      key: "at_dock_depart_curr",
      title: "At-dock / Depart-Curr",
    },
    {
      key: "at_dock_arrive_next",
      title: "At-dock / Arrive-Next",
    },
    {
      key: "at_dock_depart_next",
      title: "At-dock / Depart-Next",
    },
    {
      key: "at_sea_arrive_next",
      title: "At-sea / Arrive-Next",
    },
    {
      key: "at_sea_depart_next",
      title: "At-sea / Depart-Next",
    },
  ];

  const bucketLabel = (row: ComparisonRow) => row.bucket_key;

  cols.bucket = Math.max(
    cols.bucket,
    "Bucket".length,
    ...comparison.map((r) => bucketLabel(r).length)
  );
  cols.maeA = Math.max(cols.maeA, maeALabel.length);
  cols.maeB = Math.max(cols.maeB, maeBLabel.length);
  cols.r2A = Math.max(cols.r2A, r2ALabel.length);
  cols.r2B = Math.max(cols.r2B, r2BLabel.length);
  cols.stddevA = Math.max(cols.stddevA, stddevALabel.length);
  cols.stddevB = Math.max(cols.stddevB, stddevBLabel.length);

  for (const model of models) {
    markdown += `## ${model.title}\n\n`;
    const header = [
      pad("Bucket", cols.bucket, "left"),
      pad(maeALabel, cols.maeA, "right"),
      pad(maeBLabel, cols.maeB, "right"),
      pad("MAE Diff", cols.maeDiff, "right"),
      pad(r2ALabel, cols.r2A, "right"),
      pad(r2BLabel, cols.r2B, "right"),
      pad("R² Diff", cols.r2Diff, "right"),
      pad(stddevALabel, cols.stddevA, "right"),
      pad(stddevBLabel, cols.stddevB, "right"),
      pad("SD Diff", cols.stddevDiff, "right"),
      pad("Records", cols.records, "right"),
    ];
    markdown += `| ${header.join(" | ")} |\n`;
    markdown += `| ${[
      dashed(cols.bucket),
      dashed(cols.maeA),
      dashed(cols.maeB),
      dashed(cols.maeDiff),
      dashed(cols.r2A),
      dashed(cols.r2B),
      dashed(cols.r2Diff),
      dashed(cols.stddevA),
      dashed(cols.stddevB),
      dashed(cols.stddevDiff),
      dashed(cols.records),
    ].join(" | ")} |\n`;

    const maeAValues: number[] = [];
    const maeBValues: number[] = [];
    const maeDiffValues: number[] = [];
    const r2AValues: number[] = [];
    const r2BValues: number[] = [];
    const r2DiffValues: number[] = [];
    const stddevAValues: number[] = [];
    const stddevBValues: number[] = [];
    const stddevDiffValues: number[] = [];

    for (const row of comparison) {
      const m = row.metrics[model.key];
      if (m.mae_a != null) maeAValues.push(m.mae_a);
      if (m.mae_b != null) maeBValues.push(m.mae_b);
      if (m.mae_diff != null) maeDiffValues.push(m.mae_diff);
      if (m.r2_a != null) r2AValues.push(m.r2_a);
      if (m.r2_b != null) r2BValues.push(m.r2_b);
      if (m.r2_diff != null) r2DiffValues.push(m.r2_diff);
      if (m.stddev_a != null) stddevAValues.push(m.stddev_a);
      if (m.stddev_b != null) stddevBValues.push(m.stddev_b);
      if (m.stddev_diff != null) stddevDiffValues.push(m.stddev_diff);

      const line = [
        pad(bucketLabel(row), cols.bucket, "left"),
        pad(formatNum(m.mae_a), cols.maeA, "right"),
        pad(formatNum(m.mae_b), cols.maeB, "right"),
        pad(formatDiff(m.mae_diff), cols.maeDiff, "right"),
        pad(formatNum(m.r2_a), cols.r2A, "right"),
        pad(formatNum(m.r2_b), cols.r2B, "right"),
        pad(formatDiff(m.r2_diff), cols.r2Diff, "right"),
        pad(formatNum(m.stddev_a), cols.stddevA, "right"),
        pad(formatNum(m.stddev_b), cols.stddevB, "right"),
        pad(formatDiff(m.stddev_diff), cols.stddevDiff, "right"),
        pad(String(row.total_records), cols.records, "right"),
      ];
      markdown += `| ${line.join(" | ")} |\n`;
    }

    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;

    const avgLine = [
      pad("**Average**", cols.bucket, "left"),
      pad(formatNum(avg(maeAValues)), cols.maeA, "right"),
      pad(formatNum(avg(maeBValues)), cols.maeB, "right"),
      pad(formatDiff(avg(maeDiffValues)), cols.maeDiff, "right"),
      pad(formatNum(avg(r2AValues)), cols.r2A, "right"),
      pad(formatNum(avg(r2BValues)), cols.r2B, "right"),
      pad(formatDiff(avg(r2DiffValues)), cols.r2Diff, "right"),
      pad(formatNum(avg(stddevAValues)), cols.stddevA, "right"),
      pad(formatNum(avg(stddevBValues)), cols.stddevB, "right"),
      pad(formatDiff(avg(stddevDiffValues)), cols.stddevDiff, "right"),
      pad("", cols.records, "right"),
    ];
    markdown += `| ${avgLine.join(" | ")} |\n\n`;
  }

  markdown += "## Summary\n\n";
  markdown += `Compared **${comparison.length}** shared buckets (after filtering).\n\n`;

  for (const model of models) {
    const diffs = comparison
      .map((r) => r.metrics[model.key].mae_diff)
      .filter((d): d is number => d != null);
    const better = diffs.filter((d) => d < 0).length;
    const worse = diffs.filter((d) => d > 0).length;

    if (!diffs.length) {
      markdown += `- **${model.title}**: no comparable data\n`;
      continue;
    }

    markdown += `- **${model.title}**: second better on **${better}/${diffs.length}**, worse on **${worse}/${diffs.length}** (MAE)\n`;
  }

  markdown += `\n---\n*Generated on ${new Date().toISOString()}*\n`;

  return markdown;
};

const compareSummaries = async () => {
  const args = process.argv.slice(2);

  // Parse --all flag
  const showAll = args.includes("--all");
  const filteredArgs = args.filter((arg) => arg !== "--all");

  if (filteredArgs.length !== 2) {
    console.error(
      "Usage: npm run train:compare <fileA.csv> <fileB.csv> [--all]"
    );
    console.error(
      "Example: npm run train:compare ml/training-results.csv ml/training-results-reverted.csv"
    );
    console.error(
      "Example with --all: npm run train:compare ml/training-results.csv ml/training-results-reverted.csv --all"
    );
    console.error("Output: ml/training-results-comparison.md");
    console.error(
      "--all: Show all results without filtering noisy terminals or low-data buckets"
    );
    process.exit(1);
  }

  const [fileAPath, fileBPath] = filteredArgs;

  if (!fs.existsSync(fileAPath)) {
    console.error(`File not found: ${fileAPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(fileBPath)) {
    console.error(`File not found: ${fileBPath}`);
    process.exit(1);
  }

  const fileAContent = fs.readFileSync(fileAPath, "utf-8");
  const fileBContent = fs.readFileSync(fileBPath, "utf-8");

  const fileAData = parseCSV(fileAContent);
  const fileBData = parseCSV(fileBContent);

  const comparison = compareResults(fileAData, fileBData, showAll);
  const markdown = generateMarkdown(comparison);

  const outputPath = path.join(
    process.cwd(),
    "ml",
    "training-results-comparison.md"
  );

  writeFileSync(outputPath, markdown);

  console.log(`✅ Comparison complete: ${outputPath}`);
  console.log(`Compared ${comparison.length} shared buckets`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  compareSummaries().catch(console.error);
}
