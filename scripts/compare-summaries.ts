import * as fs from "node:fs";
import { writeFileSync } from "node:fs";
import * as path from "node:path";

interface TrainingResultRow {
  terminal_pair: string;
  arrive_depart_mae?: number;
  arrive_depart_r2?: number;
  arrive_depart_rmse?: number;
  arrive_depart_std_dev?: number;
  arrive_depart_late_mae?: number;
  arrive_depart_late_r2?: number;
  arrive_depart_late_rmse?: number;
  arrive_depart_late_std_dev?: number;
  depart_arrive_mae?: number;
  depart_arrive_r2?: number;
  depart_arrive_rmse?: number;
  depart_arrive_std_dev?: number;
  arrive_arrive_mae?: number;
  arrive_arrive_r2?: number;
  arrive_arrive_rmse?: number;
  arrive_arrive_std_dev?: number;
  depart_depart_mae?: number;
  depart_depart_r2?: number;
  depart_depart_rmse?: number;
  depart_depart_std_dev?: number;
  total_records: number;
  filtered_records: number;
  mean_departure_delay?: number;
  mean_at_sea_duration?: number;
  created_at: string;
}

const parseCSV = (content: string): TrainingResultRow[] => {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string | number | undefined> = {};

    headers.forEach((header, index) => {
      const value = values[index];
      if (value === "" || value === undefined) {
        row[header] = undefined;
      } else if (
        header.includes("mae") ||
        header.includes("r2") ||
        header.includes("rmse") ||
        header.includes("std_dev") ||
        header.includes("delay") ||
        header.includes("duration") ||
        header.includes("records")
      ) {
        row[header] = parseFloat(value);
      } else {
        row[header] = value;
      }
    });

    return row as unknown as TrainingResultRow;
  });
};

interface ComparisonRow {
  terminal_pair: string;
  // arrive-depart
  arrive_depart_mae_file_a?: number;
  arrive_depart_mae_file_b?: number;
  arrive_depart_mae_diff?: number;
  arrive_depart_r2_file_a?: number;
  arrive_depart_r2_file_b?: number;
  arrive_depart_r2_diff?: number;
  // arrive-depart-late
  arrive_depart_late_mae_file_a?: number;
  arrive_depart_late_mae_file_b?: number;
  arrive_depart_late_mae_diff?: number;
  arrive_depart_late_r2_file_a?: number;
  arrive_depart_late_r2_file_b?: number;
  arrive_depart_late_r2_diff?: number;
  // depart-arrive
  depart_arrive_mae_file_a?: number;
  depart_arrive_mae_file_b?: number;
  depart_arrive_mae_diff?: number;
  depart_arrive_r2_file_a?: number;
  depart_arrive_r2_file_b?: number;
  depart_arrive_r2_diff?: number;
  // arrive-arrive
  arrive_arrive_mae_file_a?: number;
  arrive_arrive_mae_file_b?: number;
  arrive_arrive_mae_diff?: number;
  arrive_arrive_r2_file_a?: number;
  arrive_arrive_r2_file_b?: number;
  arrive_arrive_r2_diff?: number;
  // depart-depart
  depart_depart_mae_file_a?: number;
  depart_depart_mae_file_b?: number;
  depart_depart_mae_diff?: number;
  depart_depart_r2_file_a?: number;
  depart_depart_r2_file_b?: number;
  depart_depart_r2_diff?: number;
  total_records: number;
}

const compareResults = (
  fileAData: TrainingResultRow[],
  fileBData: TrainingResultRow[],
  fileALabel: string,
  fileBLabel: string
): ComparisonRow[] => {
  const comparison: ComparisonRow[] = [];

  // Create a map for easier lookup
  const fileBMap = new Map(fileBData.map((row) => [row.terminal_pair, row]));

  fileAData.forEach((fileARow) => {
    const fileBRow = fileBMap.get(fileARow.terminal_pair);
    if (!fileBRow) {
      console.log(
        `Missing data for ${fileARow.terminal_pair} in ${fileBLabel} results`
      );
      return;
    }

    // Skip rows where either file has fewer than 100 total_records
    if (fileARow.total_records < 100 || fileBRow.total_records < 100) {
      console.log(
        `Skipping ${fileARow.terminal_pair} (insufficient records: ${fileALabel}=${fileARow.total_records}, ${fileBLabel}=${fileBRow.total_records})`
      );
      return;
    }

    // Skip rows where terminal pair includes "ORI"
    if (fileARow.terminal_pair.includes("ORI")) {
      console.log(`Skipping ${fileARow.terminal_pair} (contains ORI terminal)`);
      return;
    }

    // Helper to get metric value
    const getMetric = (
      row: TrainingResultRow,
      modelType:
        | "arrive-depart"
        | "arrive-depart-late"
        | "depart-arrive"
        | "arrive-arrive"
        | "depart-depart",
      metric: "mae" | "r2"
    ): number | undefined => {
      const key =
        `${modelType.replace(/-/g, "_")}_${metric}` as keyof TrainingResultRow;
      return row[key] as number | undefined;
    };

    const calcDiff = (a?: number, b?: number) =>
      a != null && b != null ? b - a : undefined;

    comparison.push({
      terminal_pair: fileARow.terminal_pair,
      // arrive-depart metrics
      arrive_depart_mae_file_a: getMetric(fileARow, "arrive-depart", "mae"),
      arrive_depart_mae_file_b: getMetric(fileBRow, "arrive-depart", "mae"),
      arrive_depart_mae_diff: calcDiff(
        getMetric(fileARow, "arrive-depart", "mae"),
        getMetric(fileBRow, "arrive-depart", "mae")
      ),
      arrive_depart_r2_file_a: getMetric(fileARow, "arrive-depart", "r2"),
      arrive_depart_r2_file_b: getMetric(fileBRow, "arrive-depart", "r2"),
      arrive_depart_r2_diff: calcDiff(
        getMetric(fileARow, "arrive-depart", "r2"),
        getMetric(fileBRow, "arrive-depart", "r2")
      ),
      // arrive-depart-late metrics
      arrive_depart_late_mae_file_a: getMetric(
        fileARow,
        "arrive-depart-late",
        "mae"
      ),
      arrive_depart_late_mae_file_b: getMetric(
        fileBRow,
        "arrive-depart-late",
        "mae"
      ),
      arrive_depart_late_mae_diff: calcDiff(
        getMetric(fileARow, "arrive-depart-late", "mae"),
        getMetric(fileBRow, "arrive-depart-late", "mae")
      ),
      arrive_depart_late_r2_file_a: getMetric(
        fileARow,
        "arrive-depart-late",
        "r2"
      ),
      arrive_depart_late_r2_file_b: getMetric(
        fileBRow,
        "arrive-depart-late",
        "r2"
      ),
      arrive_depart_late_r2_diff: calcDiff(
        getMetric(fileARow, "arrive-depart-late", "r2"),
        getMetric(fileBRow, "arrive-depart-late", "r2")
      ),
      // depart-arrive metrics
      depart_arrive_mae_file_a: getMetric(fileARow, "depart-arrive", "mae"),
      depart_arrive_mae_file_b: getMetric(fileBRow, "depart-arrive", "mae"),
      depart_arrive_mae_diff: calcDiff(
        getMetric(fileARow, "depart-arrive", "mae"),
        getMetric(fileBRow, "depart-arrive", "mae")
      ),
      depart_arrive_r2_file_a: getMetric(fileARow, "depart-arrive", "r2"),
      depart_arrive_r2_file_b: getMetric(fileBRow, "depart-arrive", "r2"),
      depart_arrive_r2_diff: calcDiff(
        getMetric(fileARow, "depart-arrive", "r2"),
        getMetric(fileBRow, "depart-arrive", "r2")
      ),
      // arrive-arrive metrics
      arrive_arrive_mae_file_a: getMetric(fileARow, "arrive-arrive", "mae"),
      arrive_arrive_mae_file_b: getMetric(fileBRow, "arrive-arrive", "mae"),
      arrive_arrive_mae_diff: calcDiff(
        getMetric(fileARow, "arrive-arrive", "mae"),
        getMetric(fileBRow, "arrive-arrive", "mae")
      ),
      arrive_arrive_r2_file_a: getMetric(fileARow, "arrive-arrive", "r2"),
      arrive_arrive_r2_file_b: getMetric(fileBRow, "arrive-arrive", "r2"),
      arrive_arrive_r2_diff: calcDiff(
        getMetric(fileARow, "arrive-arrive", "r2"),
        getMetric(fileBRow, "arrive-arrive", "r2")
      ),
      // depart-depart metrics
      depart_depart_mae_file_a: getMetric(fileARow, "depart-depart", "mae"),
      depart_depart_mae_file_b: getMetric(fileBRow, "depart-depart", "mae"),
      depart_depart_mae_diff: calcDiff(
        getMetric(fileARow, "depart-depart", "mae"),
        getMetric(fileBRow, "depart-depart", "mae")
      ),
      depart_depart_r2_file_a: getMetric(fileARow, "depart-depart", "r2"),
      depart_depart_r2_file_b: getMetric(fileBRow, "depart-depart", "r2"),
      depart_depart_r2_diff: calcDiff(
        getMetric(fileARow, "depart-depart", "r2"),
        getMetric(fileBRow, "depart-depart", "r2")
      ),
      total_records: fileARow.total_records,
    });
  });

  return comparison;
};

const generateComparisonTable = (
  comparison: ComparisonRow[],
  fileALabel: string,
  fileBLabel: string
): string => {
  let markdown = `# Training Results Comparison: ${fileALabel} vs ${fileBLabel}

Comparing ML model performance between ${fileALabel} and ${fileBLabel}

**Interpretation:**
- Positive MAE difference = ${fileBLabel} performs worse (higher error)
- Negative MAE difference = ${fileBLabel} performs better (lower error)
- Positive R² difference = ${fileBLabel} performs better (higher explanatory power)
- Negative R² difference = ${fileBLabel} performs worse (lower explanatory power)

## Detailed Comparison

`;

  const formatNum = (num?: number) => (num != null ? num.toFixed(3) : "N/A");
  const formatDiff = (diff?: number) => {
    if (diff == null) return "N/A";
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff.toFixed(3)}`;
  };

  // Helper function to generate table rows for a model type
  const generateTableRows = (
    modelType:
      | "arrive-depart"
      | "arrive-depart-late"
      | "depart-arrive"
      | "arrive-arrive"
      | "depart-depart"
  ) => {
    let rows = "";
    const maeAValues: number[] = [];
    const maeBValues: number[] = [];
    const maeDiffValues: number[] = [];
    const r2AValues: number[] = [];
    const r2BValues: number[] = [];
    const r2DiffValues: number[] = [];

    comparison.forEach((row) => {
      let maeA: number | undefined;
      let maeB: number | undefined;
      let maeDiff: number | undefined;
      let r2A: number | undefined;
      let r2B: number | undefined;
      let r2Diff: number | undefined;

      if (modelType === "arrive-depart") {
        maeA = row.arrive_depart_mae_file_a;
        maeB = row.arrive_depart_mae_file_b;
        maeDiff = row.arrive_depart_mae_diff;
        r2A = row.arrive_depart_r2_file_a;
        r2B = row.arrive_depart_r2_file_b;
        r2Diff = row.arrive_depart_r2_diff;
      } else if (modelType === "arrive-depart-late") {
        maeA = row.arrive_depart_late_mae_file_a;
        maeB = row.arrive_depart_late_mae_file_b;
        maeDiff = row.arrive_depart_late_mae_diff;
        r2A = row.arrive_depart_late_r2_file_a;
        r2B = row.arrive_depart_late_r2_file_b;
        r2Diff = row.arrive_depart_late_r2_diff;
      } else if (modelType === "depart-arrive") {
        maeA = row.depart_arrive_mae_file_a;
        maeB = row.depart_arrive_mae_file_b;
        maeDiff = row.depart_arrive_mae_diff;
        r2A = row.depart_arrive_r2_file_a;
        r2B = row.depart_arrive_r2_file_b;
        r2Diff = row.depart_arrive_r2_diff;
      } else if (modelType === "arrive-arrive") {
        maeA = row.arrive_arrive_mae_file_a;
        maeB = row.arrive_arrive_mae_file_b;
        maeDiff = row.arrive_arrive_mae_diff;
        r2A = row.arrive_arrive_r2_file_a;
        r2B = row.arrive_arrive_r2_file_b;
        r2Diff = row.arrive_arrive_r2_diff;
      } else {
        // depart-depart
        maeA = row.depart_depart_mae_file_a;
        maeB = row.depart_depart_mae_file_b;
        maeDiff = row.depart_depart_mae_diff;
        r2A = row.depart_depart_r2_file_a;
        r2B = row.depart_depart_r2_file_b;
        r2Diff = row.depart_depart_r2_diff;
      }

      if (maeA != null) maeAValues.push(maeA);
      if (maeB != null) maeBValues.push(maeB);
      if (maeDiff != null) maeDiffValues.push(maeDiff);
      if (r2A != null) r2AValues.push(r2A);
      if (r2B != null) r2BValues.push(r2B);
      if (r2Diff != null) r2DiffValues.push(r2Diff);

      rows += `| ${row.terminal_pair.padEnd(13)} | ${formatNum(maeA).padStart(13)} | ${formatNum(maeB).padStart(8)} | ${formatDiff(maeDiff).padStart(8)} | ${formatNum(r2A).padStart(12)} | ${formatNum(r2B).padStart(7)} | ${formatDiff(r2Diff).padStart(7)} | ${row.total_records.toString().padStart(7)} |\n`;
    });

    // Add summary row
    const avgMaeA =
      maeAValues.length > 0
        ? maeAValues.reduce((a, b) => a + b, 0) / maeAValues.length
        : 0;
    const avgMaeB =
      maeBValues.length > 0
        ? maeBValues.reduce((a, b) => a + b, 0) / maeBValues.length
        : 0;
    const avgMaeDiff =
      maeDiffValues.length > 0
        ? maeDiffValues.reduce((a, b) => a + b, 0) / maeDiffValues.length
        : 0;
    const avgR2A =
      r2AValues.length > 0
        ? r2AValues.reduce((a, b) => a + b, 0) / r2AValues.length
        : 0;
    const avgR2B =
      r2BValues.length > 0
        ? r2BValues.reduce((a, b) => a + b, 0) / r2BValues.length
        : 0;
    const avgR2Diff =
      r2DiffValues.length > 0
        ? r2DiffValues.reduce((a, b) => a + b, 0) / r2DiffValues.length
        : 0;

    rows += `| **Average**     | ${formatNum(avgMaeA).padStart(13)} | ${formatNum(avgMaeB).padStart(8)} | ${formatDiff(avgMaeDiff).padStart(8)} | ${formatNum(avgR2A).padStart(12)} | ${formatNum(avgR2B).padStart(7)} | ${formatDiff(avgR2Diff).padStart(7)} |         |\n`;

    return rows;
  };

  // Generate tables for each model type with proper headers and rows
  const modelTypes = [
    { key: "arrive-depart", title: "Arrive-Depart Model" },
    { key: "arrive-depart-late", title: "Arrive-Depart-Late Model" },
    { key: "depart-arrive", title: "Depart-Arrive Model" },
    { key: "arrive-arrive", title: "Arrive-Arrive Model" },
    { key: "depart-depart", title: "Depart-Depart Model" },
  ] as const;

  modelTypes.forEach(({ key, title }) => {
    markdown += `### ${title}\n\n`;
    markdown += `| Terminal Pair | MAE (${fileALabel}) | MAE (${fileBLabel}) | MAE Diff | R² (${fileALabel}) | R² (${fileBLabel}) | R² Diff | Records |\n`;
    markdown += `|---------------|---------------------|---------------------|----------|---------------------|---------------------|---------|----------|\n`;
    markdown += generateTableRows(key);
    markdown += "\n";
  });

  markdown += "\n## Summary Statistics\n\n";

  const arriveDepartMae = comparison
    .map((r) => r.arrive_depart_mae_diff)
    .filter((d): d is number => d != null);
  const arriveDepartR2 = comparison
    .map((r) => r.arrive_depart_r2_diff)
    .filter((d): d is number => d != null);
  const departArriveMae = comparison
    .map((r) => r.depart_arrive_mae_diff)
    .filter((d): d is number => d != null);
  const departArriveR2 = comparison
    .map((r) => r.depart_arrive_r2_diff)
    .filter((d): d is number => d != null);
  const arriveArriveMae = comparison
    .map((r) => r.arrive_arrive_mae_diff)
    .filter((d): d is number => d != null);
  const arriveArriveR2 = comparison
    .map((r) => r.arrive_arrive_r2_diff)
    .filter((d): d is number => d != null);
  const departDepartMae = comparison
    .map((r) => r.depart_depart_mae_diff)
    .filter((d): d is number => d != null);
  const departDepartR2 = comparison
    .map((r) => r.depart_depart_r2_diff)
    .filter((d): d is number => d != null);

  markdown += "### Arrive-Depart Model\n";
  if (arriveDepartMae.length > 0) {
    markdown += `**Better MAE performance (${fileBLabel}):** ${arriveDepartMae.filter((d) => d < 0).length}/${arriveDepartMae.length} terminal pairs\n`;
    markdown += `**Better R² performance (${fileBLabel}):** ${arriveDepartR2.filter((d) => d > 0).length}/${arriveDepartR2.length} terminal pairs\n`;
  } else {
    markdown += "No data available\n";
  }

  const arriveDepartLateMae = comparison
    .map((r) => r.arrive_depart_late_mae_diff)
    .filter((d): d is number => d != null);
  const arriveDepartLateR2 = comparison
    .map((r) => r.arrive_depart_late_r2_diff)
    .filter((d): d is number => d != null);

  markdown += "\n### Arrive-Depart-Late Model\n";
  if (arriveDepartLateMae.length > 0) {
    markdown += `**Better MAE performance (${fileBLabel}):** ${arriveDepartLateMae.filter((d) => d < 0).length}/${arriveDepartLateMae.length} terminal pairs\n`;
    markdown += `**Better R² performance (${fileBLabel}):** ${arriveDepartLateR2.filter((d) => d > 0).length}/${arriveDepartLateR2.length} terminal pairs\n`;
  } else {
    markdown += "No data available\n";
  }

  markdown += "\n### Depart-Arrive Model\n";
  if (departArriveMae.length > 0) {
    markdown += `**Better MAE performance (${fileBLabel}):** ${departArriveMae.filter((d) => d < 0).length}/${departArriveMae.length} terminal pairs\n`;
    markdown += `**Better R² performance (${fileBLabel}):** ${departArriveR2.filter((d) => d > 0).length}/${departArriveR2.length} terminal pairs\n`;
  } else {
    markdown += "No data available\n";
  }

  markdown += "\n### Arrive-Arrive Model\n";
  if (arriveArriveMae.length > 0) {
    markdown += `**Better MAE performance (${fileBLabel}):** ${arriveArriveMae.filter((d) => d < 0).length}/${arriveArriveMae.length} terminal pairs\n`;
    markdown += `**Better R² performance (${fileBLabel}):** ${arriveArriveR2.filter((d) => d > 0).length}/${arriveArriveR2.length} terminal pairs\n`;
  } else {
    markdown += "No data available\n";
  }

  markdown += "\n### Depart-Depart Model\n";
  if (departDepartMae.length > 0) {
    markdown += `**Better MAE performance (${fileBLabel}):** ${departDepartMae.filter((d) => d < 0).length}/${departDepartMae.length} terminal pairs\n`;
    markdown += `**Better R² performance (${fileBLabel}):** ${departDepartR2.filter((d) => d > 0).length}/${departDepartR2.length} terminal pairs\n`;
  } else {
    markdown += "No data available\n";
  }

  // Overall recommendation - count better performance across all 5 model types
  const arriveDepartBetterCount = arriveDepartMae.filter((d) => d < 0).length;
  const arriveDepartLateBetterCount = arriveDepartLateMae.filter(
    (d) => d < 0
  ).length;
  const departArriveBetterCount = departArriveMae.filter((d) => d < 0).length;
  const arriveArriveBetterCount = arriveArriveMae.filter((d) => d < 0).length;
  const departDepartBetterCount = departDepartMae.filter((d) => d < 0).length;

  const totalBetterCount =
    arriveDepartBetterCount +
    arriveDepartLateBetterCount +
    departArriveBetterCount +
    arriveArriveBetterCount +
    departDepartBetterCount;
  const totalModelCount =
    arriveDepartMae.length +
    arriveDepartLateMae.length +
    departArriveMae.length +
    arriveArriveMae.length +
    departDepartMae.length;
  const totalRoutes = Math.max(
    arriveDepartMae.length,
    departArriveMae.length,
    arriveArriveMae.length,
    departDepartMae.length
  );

  markdown += "\n## Comparison Summary\n\n";
  markdown += `Out of ${totalRoutes} routes tested with sufficient data (≥100 records):\n`;
  markdown += `- ${totalBetterCount} route-model combinations perform better with ${fileBLabel} (lower MAE)\n`;
  markdown += `- ${totalModelCount - totalBetterCount} route-model combinations perform better with ${fileALabel} (lower MAE)\n\n`;
  markdown += `Breakdown by model type:\n`;
  markdown += `- Arrive-Depart: ${arriveDepartBetterCount}/${arriveDepartMae.length} routes better with ${fileBLabel}\n`;
  markdown += `- Arrive-Depart-Late: ${arriveDepartLateBetterCount}/${arriveDepartLateMae.length} routes better with ${fileBLabel}\n`;
  markdown += `- Depart-Arrive: ${departArriveBetterCount}/${departArriveMae.length} routes better with ${fileBLabel}\n`;
  markdown += `- Arrive-Arrive: ${arriveArriveBetterCount}/${arriveArriveMae.length} routes better with ${fileBLabel}\n`;
  markdown += `- Depart-Depart: ${departDepartBetterCount}/${departDepartMae.length} routes better with ${fileBLabel}\n\n`;

  if (totalBetterCount > totalModelCount / 2) {
    markdown += `**RECOMMENDATION:** ${fileBLabel} performs better overall (${totalBetterCount}/${totalModelCount} models)\n`;
  } else {
    markdown += `**RECOMMENDATION:** ${fileALabel} performs better overall (${totalModelCount - totalBetterCount}/${totalModelCount} models)\n`;
  }

  markdown += `\n---\n*Generated on ${new Date().toISOString()}*`;

  return markdown;
};

const compareSummaries = async () => {
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error("Usage: npm run train:compare <fileA.csv> <fileB.csv>");
    console.error(
      "Example: npm run train:compare training-results-with-feature.csv training-results-without-feature.csv"
    );
    console.error("Output: ml/training-results-comparison.md");
    process.exit(1);
  }

  const [fileAPath, fileBPath] = args;
  const fileALabel = path
    .basename(fileAPath, ".csv")
    .replace("training-results-", "");
  const fileBLabel = path
    .basename(fileBPath, ".csv")
    .replace("training-results-", "");

  console.log("Loading CSV files for comparison...");

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

  console.log(`Loaded ${fileAData.length} records from ${fileALabel}`);
  console.log(`Loaded ${fileBData.length} records from ${fileBLabel}`);

  const comparison = compareResults(
    fileAData,
    fileBData,
    fileALabel,
    fileBLabel
  );
  const markdownContent = generateComparisonTable(
    comparison,
    fileALabel,
    fileBLabel
  );

  // Write to file (delete existing summary if it exists)
  const outputPath = path.join(
    __dirname,
    "..",
    "ml",
    "training-results-comparison.md"
  );

  // Delete existing summary file if it exists
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`Deleted existing summary file: ${outputPath}`);
  }

  writeFileSync(outputPath, markdownContent);

  console.log(`\nComparison complete! Results saved to ${outputPath}`);
  console.log(
    `Compared ${fileALabel} vs ${fileBLabel} across ${comparison.length} terminal pairs`
  );
};

// Run if called directly
if (require.main === module) {
  compareSummaries().catch(console.error);
}
