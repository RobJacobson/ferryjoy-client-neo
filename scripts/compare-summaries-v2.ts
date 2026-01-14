import * as fs from "node:fs";
import { writeFileSync } from "node:fs";
import * as path from "node:path";

type BucketType = "chain" | "pair";

type TrainingResultRowV2 = {
  bucket_type: BucketType;
  bucket_key: string;

  in_service_at_dock_depart_b_mae?: number;
  in_service_at_dock_depart_b_r2?: number;
  in_service_at_dock_depart_b_rmse?: number;

  in_service_at_dock_arrive_c_mae?: number;
  in_service_at_dock_arrive_c_r2?: number;
  in_service_at_dock_arrive_c_rmse?: number;

  in_service_at_dock_depart_c_mae?: number;
  in_service_at_dock_depart_c_r2?: number;
  in_service_at_dock_depart_c_rmse?: number;

  in_service_at_sea_arrive_c_mae?: number;
  in_service_at_sea_arrive_c_r2?: number;
  in_service_at_sea_arrive_c_rmse?: number;

  in_service_at_sea_depart_c_mae?: number;
  in_service_at_sea_depart_c_r2?: number;
  in_service_at_sea_depart_c_rmse?: number;

  layover_at_dock_depart_b_mae?: number;
  layover_at_dock_depart_b_r2?: number;
  layover_at_dock_depart_b_rmse?: number;

  layover_at_dock_arrive_c_mae?: number;
  layover_at_dock_arrive_c_r2?: number;
  layover_at_dock_arrive_c_rmse?: number;

  layover_at_dock_depart_c_mae?: number;
  layover_at_dock_depart_c_r2?: number;
  layover_at_dock_depart_c_rmse?: number;

  layover_at_sea_arrive_c_mae?: number;
  layover_at_sea_arrive_c_r2?: number;
  layover_at_sea_arrive_c_rmse?: number;

  layover_at_sea_depart_c_mae?: number;
  layover_at_sea_depart_c_r2?: number;
  layover_at_sea_depart_c_rmse?: number;

  total_records: number;
  sampled_records: number;
  created_at: string;
};

type ModelKeyV2 =
  | "in_service_at_dock_depart_b"
  | "in_service_at_dock_arrive_c"
  | "in_service_at_dock_depart_c"
  | "in_service_at_sea_arrive_c"
  | "in_service_at_sea_depart_c"
  | "layover_at_dock_depart_b"
  | "layover_at_dock_arrive_c"
  | "layover_at_dock_depart_c"
  | "layover_at_sea_arrive_c"
  | "layover_at_sea_depart_c";

type MetricKeyV2 = "mae" | "r2";

type ComparisonRowV2 = {
  bucket_type: BucketType;
  bucket_key: string;
  total_records: number;

  // Per-model metric values for file A / file B / diff
  metrics: Record<
    ModelKeyV2,
    {
      mae_a?: number;
      mae_b?: number;
      mae_diff?: number;
      r2_a?: number;
      r2_b?: number;
      r2_diff?: number;
    }
  >;
};

const parseCSV = (content: string): TrainingResultRowV2[] => {
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
        header.endsWith("_records")
      ) {
        row[header] = parseFloat(value);
        return;
      }

      row[header] = value;
    });

    return row as unknown as TrainingResultRowV2;
  });
};

const getMetric = (
  row: TrainingResultRowV2,
  modelKey: ModelKeyV2,
  metric: MetricKeyV2
): number | undefined => {
  const key = `${modelKey}_${metric}` as keyof TrainingResultRowV2;
  return row[key] as number | undefined;
};

const calcDiff = (a?: number, b?: number) =>
  a != null && b != null ? b - a : undefined;

const shouldSkip = (rowA: TrainingResultRowV2, rowB: TrainingResultRowV2) => {
  // Keep parity with the existing script’s “only meaningful routes” default.
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

  return false;
};

const compareResultsV2 = (
  fileAData: TrainingResultRowV2[],
  fileBData: TrainingResultRowV2[]
): ComparisonRowV2[] => {
  const fileBMap = new Map(
    fileBData.map((row) => [`${row.bucket_type}|${row.bucket_key}`, row])
  );

  const modelKeys: ModelKeyV2[] = [
    "in_service_at_dock_depart_b",
    "in_service_at_dock_arrive_c",
    "in_service_at_dock_depart_c",
    "in_service_at_sea_arrive_c",
    "in_service_at_sea_depart_c",
    "layover_at_dock_depart_b",
    "layover_at_dock_arrive_c",
    "layover_at_dock_depart_c",
    "layover_at_sea_arrive_c",
    "layover_at_sea_depart_c",
  ];

  const comparison: ComparisonRowV2[] = [];

  for (const rowA of fileAData) {
    const rowB = fileBMap.get(`${rowA.bucket_type}|${rowA.bucket_key}`);
    if (!rowB) {
      continue;
    }

    if (shouldSkip(rowA, rowB)) {
      continue;
    }

    const metrics = modelKeys.reduce(
      (acc, modelKey) => {
        const maeA = getMetric(rowA, modelKey, "mae");
        const maeB = getMetric(rowB, modelKey, "mae");
        const r2A = getMetric(rowA, modelKey, "r2");
        const r2B = getMetric(rowB, modelKey, "r2");

        acc[modelKey] = {
          mae_a: maeA,
          mae_b: maeB,
          mae_diff: calcDiff(maeA, maeB),
          r2_a: r2A,
          r2_b: r2B,
          r2_diff: calcDiff(r2A, r2B),
        };
        return acc;
      },
      {} as ComparisonRowV2["metrics"]
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

const generateMarkdown = (
  comparison: ComparisonRowV2[],
  fileALabel: string,
  fileBLabel: string
): string => {
  let markdown = `# Training Results Comparison (V2): ${fileALabel} vs ${fileBLabel}

Comparing ML v2 model performance between **${fileALabel}** and **${fileBLabel}**.

**Interpretation**
- Positive MAE diff = ${fileBLabel} is worse (higher error)
- Negative MAE diff = ${fileBLabel} is better (lower error)
- Positive R² diff = ${fileBLabel} is better (higher explanatory power)
- Negative R² diff = ${fileBLabel} is worse (lower explanatory power)

`;

  const formatNum = (num?: number) => (num != null ? num.toFixed(3) : "N/A");
  const formatDiff = (diff?: number) => {
    if (diff == null) return "N/A";
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff.toFixed(3)}`;
  };

  // Keep tables readable in raw markdown by padding columns.
  const BASE_COLS = {
    bucket: 18,
    maeA: 12,
    maeB: 17,
    maeDiff: 9,
    r2A: 12,
    r2B: 17,
    r2Diff: 8,
    records: 7,
  } as const;

  const cols: Record<keyof typeof BASE_COLS, number> = { ...BASE_COLS };

  const maeALabel = `MAE (${fileALabel})`;
  const maeBLabel = `MAE (${fileBLabel})`;
  const r2ALabel = `R² (${fileALabel})`;
  const r2BLabel = `R² (${fileBLabel})`;

  const pad = (value: string, width: number, align: "left" | "right") => {
    return align === "right" ? value.padStart(width) : value.padEnd(width);
  };

  const dashed = (width: number) => "-".repeat(width);

  const models: Array<{ key: ModelKeyV2; title: string }> = [
    {
      key: "in_service_at_dock_depart_b",
      title: "In-service / At-dock / Depart-Curr",
    },
    {
      key: "in_service_at_dock_arrive_c",
      title: "In-service / At-dock / Arrive-Next",
    },
    {
      key: "in_service_at_dock_depart_c",
      title: "In-service / At-dock / Depart-Next",
    },
    {
      key: "in_service_at_sea_arrive_c",
      title: "In-service / At-sea / Arrive-Next",
    },
    {
      key: "in_service_at_sea_depart_c",
      title: "In-service / At-sea / Depart-Next",
    },
    {
      key: "layover_at_dock_depart_b",
      title: "Layover / At-dock / Depart-Curr",
    },
    {
      key: "layover_at_dock_arrive_c",
      title: "Layover / At-dock / Arrive-Next",
    },
    {
      key: "layover_at_dock_depart_c",
      title: "Layover / At-dock / Depart-Next",
    },
    {
      key: "layover_at_sea_arrive_c",
      title: "Layover / At-sea / Arrive-Next",
    },
    {
      key: "layover_at_sea_depart_c",
      title: "Layover / At-sea / Depart-Next",
    },
  ];

  const bucketLabel = (row: ComparisonRowV2) =>
    `${row.bucket_type}|${row.bucket_key}`;

  // Expand columns to fit headers + longest bucket label (avoid truncation).
  cols.bucket = Math.max(
    cols.bucket,
    "Bucket".length,
    ...comparison.map((r) => bucketLabel(r).length)
  );
  cols.maeA = Math.max(cols.maeA, maeALabel.length);
  cols.maeB = Math.max(cols.maeB, maeBLabel.length);
  cols.r2A = Math.max(cols.r2A, r2ALabel.length);
  cols.r2B = Math.max(cols.r2B, r2BLabel.length);

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
      dashed(cols.records),
    ].join(" | ")} |\n`;

    const maeAValues: number[] = [];
    const maeBValues: number[] = [];
    const maeDiffValues: number[] = [];
    const r2AValues: number[] = [];
    const r2BValues: number[] = [];
    const r2DiffValues: number[] = [];

    for (const row of comparison) {
      const m = row.metrics[model.key];
      if (m.mae_a != null) maeAValues.push(m.mae_a);
      if (m.mae_b != null) maeBValues.push(m.mae_b);
      if (m.mae_diff != null) maeDiffValues.push(m.mae_diff);
      if (m.r2_a != null) r2AValues.push(m.r2_a);
      if (m.r2_b != null) r2BValues.push(m.r2_b);
      if (m.r2_diff != null) r2DiffValues.push(m.r2_diff);

      const line = [
        pad(bucketLabel(row), cols.bucket, "left"),
        pad(formatNum(m.mae_a), cols.maeA, "right"),
        pad(formatNum(m.mae_b), cols.maeB, "right"),
        pad(formatDiff(m.mae_diff), cols.maeDiff, "right"),
        pad(formatNum(m.r2_a), cols.r2A, "right"),
        pad(formatNum(m.r2_b), cols.r2B, "right"),
        pad(formatDiff(m.r2_diff), cols.r2Diff, "right"),
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
      pad("", cols.records, "right"),
    ];
    markdown += `| ${avgLine.join(" | ")} |\n\n`;
  }

  // Summary
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

    markdown += `- **${model.title}**: ${fileBLabel} better on **${better}/${diffs.length}**, worse on **${worse}/${diffs.length}** (MAE)\n`;
  }

  markdown += `\n---\n*Generated on ${new Date().toISOString()}*\n`;

  return markdown;
};

const compareSummariesV2 = async () => {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error("Usage: npm run train:compare:v2 <fileA.csv> <fileB.csv>");
    console.error(
      "Example: npm run train:compare:v2 ml/training-results-v2.csv ml/training-results-v2-reverted.csv"
    );
    console.error("Output: ml/training-results-v2-comparison.md");
    process.exit(1);
  }

  const [fileAPath, fileBPath] = args;
  const toLabel = (filePath: string) =>
    path.basename(filePath, ".csv").replace("training-results-", "");
  const fileALabel = toLabel(fileAPath);
  const fileBLabel = toLabel(fileBPath);

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

  const comparison = compareResultsV2(fileAData, fileBData);
  const markdown = generateMarkdown(comparison, fileALabel, fileBLabel);

  const outputPath = path.join(
    process.cwd(),
    "ml",
    "training-results-v2-comparison.md"
  );

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  writeFileSync(outputPath, markdown);

  console.log(`✅ Comparison complete: ${outputPath}`);
  console.log(`Compared ${comparison.length} shared buckets`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  compareSummariesV2().catch(console.error);
}
