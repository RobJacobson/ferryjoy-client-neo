import * as fs from "node:fs";
import { writeFileSync } from "node:fs";
import * as path from "node:path";

interface TrainingResultRow {
  terminal_pair: string;
  departure_mae?: number;
  departure_r2?: number;
  departure_rmse?: number;
  departure_std_dev?: number;
  arrival_mae?: number;
  arrival_r2?: number;
  arrival_rmse?: number;
  arrival_std_dev?: number;
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

    return row as TrainingResultRow;
  });
};

interface ComparisonRow {
  terminal_pair: string;
  departure_mae_file_a?: number;
  departure_mae_file_b?: number;
  departure_mae_diff?: number;
  departure_r2_file_a?: number;
  departure_r2_file_b?: number;
  departure_r2_diff?: number;
  arrival_mae_file_a?: number;
  arrival_mae_file_b?: number;
  arrival_mae_diff?: number;
  arrival_r2_file_a?: number;
  arrival_r2_file_b?: number;
  arrival_r2_diff?: number;
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

    comparison.push({
      terminal_pair: fileARow.terminal_pair,
      // Departure metrics
      departure_mae_file_a: fileARow.departure_mae,
      departure_mae_file_b: fileBRow.departure_mae,
      departure_mae_diff: fileBRow.departure_mae
        ? fileBRow.departure_mae - (fileARow.departure_mae || 0)
        : undefined,
      departure_r2_file_a: fileARow.departure_r2,
      departure_r2_file_b: fileBRow.departure_r2,
      departure_r2_diff: fileBRow.departure_r2
        ? fileBRow.departure_r2 - (fileARow.departure_r2 || 0)
        : undefined,

      // Arrival metrics
      arrival_mae_file_a: fileARow.arrival_mae,
      arrival_mae_file_b: fileBRow.arrival_mae,
      arrival_mae_diff: fileBRow.arrival_mae
        ? fileBRow.arrival_mae - (fileARow.arrival_mae || 0)
        : undefined,
      arrival_r2_file_a: fileARow.arrival_r2,
      arrival_r2_file_b: fileBRow.arrival_r2,
      arrival_r2_diff: fileBRow.arrival_r2
        ? fileBRow.arrival_r2 - (fileARow.arrival_r2 || 0)
        : undefined,

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

| Terminal Pair | Departure MAE |  |  | Departure R² |  |  | Arrival MAE |  |  | Arrival R² |  |  | Records |
|---------------|---------------|----------|----------|--------------|---------|---------|-------------|----------|----------|------------|---------|---------|---------|
|               | ${fileALabel.padEnd(13)} | ${fileBLabel.padEnd(8)} | Diff     | ${fileALabel.padEnd(12)} | ${fileBLabel.padEnd(7)} | Diff    | ${fileALabel.padEnd(11)} | ${fileBLabel.padEnd(8)} | Diff     | ${fileALabel.padEnd(10)} | ${fileBLabel.padEnd(7)} | Diff    |         |
`;

  comparison.forEach((row) => {
    const formatNum = (num?: number) => (num != null ? num.toFixed(3) : "N/A");
    const formatDiff = (diff?: number) => {
      if (diff == null) return "N/A";
      const sign = diff > 0 ? "+" : "";
      return `${sign}${diff.toFixed(3)}`;
    };

    markdown += `| ${row.terminal_pair.padEnd(13)} | ${formatNum(row.departure_mae_file_a).padStart(13)} | ${formatNum(row.departure_mae_file_b).padStart(8)} | ${formatDiff(row.departure_mae_diff).padStart(8)} | ${formatNum(row.departure_r2_file_a).padStart(12)} | ${formatNum(row.departure_r2_file_b).padStart(7)} | ${formatDiff(row.departure_r2_diff).padStart(7)} | ${formatNum(row.arrival_mae_file_a).padStart(11)} | ${formatNum(row.arrival_mae_file_b).padStart(8)} | ${formatDiff(row.arrival_mae_diff).padStart(8)} | ${formatNum(row.arrival_r2_file_a).padStart(10)} | ${formatNum(row.arrival_r2_file_b).padStart(7)} | ${formatDiff(row.arrival_r2_diff).padStart(7)} | ${row.total_records.toString().padStart(7)} |\n`;
  });

  // Add summary row with averages
  if (comparison.length > 0) {
    const formatNum = (num?: number) => (num != null ? num.toFixed(3) : "N/A");
    const formatDiff = (diff?: number) => {
      if (diff == null) return "N/A";
      const sign = diff > 0 ? "+" : "";
      return `${sign}${diff.toFixed(3)}`;
    };

    // Calculate averages for each column
    const avgDepartureMaeA =
      comparison.reduce(
        (sum, row) => sum + (row.departure_mae_file_a || 0),
        0
      ) / comparison.length;
    const avgDepartureMaeB =
      comparison.reduce(
        (sum, row) => sum + (row.departure_mae_file_b || 0),
        0
      ) / comparison.length;
    const avgDepartureMaeDiff =
      comparison.reduce((sum, row) => sum + (row.departure_mae_diff || 0), 0) /
      comparison.length;

    const avgDepartureR2A =
      comparison.reduce((sum, row) => sum + (row.departure_r2_file_a || 0), 0) /
      comparison.length;
    const avgDepartureR2B =
      comparison.reduce((sum, row) => sum + (row.departure_r2_file_b || 0), 0) /
      comparison.length;
    const avgDepartureR2Diff =
      comparison.reduce((sum, row) => sum + (row.departure_r2_diff || 0), 0) /
      comparison.length;

    const avgArrivalMaeA =
      comparison.reduce((sum, row) => sum + (row.arrival_mae_file_a || 0), 0) /
      comparison.length;
    const avgArrivalMaeB =
      comparison.reduce((sum, row) => sum + (row.arrival_mae_file_b || 0), 0) /
      comparison.length;
    const avgArrivalMaeDiff =
      comparison.reduce((sum, row) => sum + (row.arrival_mae_diff || 0), 0) /
      comparison.length;

    const avgArrivalR2A =
      comparison.reduce((sum, row) => sum + (row.arrival_r2_file_a || 0), 0) /
      comparison.length;
    const avgArrivalR2B =
      comparison.reduce((sum, row) => sum + (row.arrival_r2_file_b || 0), 0) /
      comparison.length;
    const avgArrivalR2Diff =
      comparison.reduce((sum, row) => sum + (row.arrival_r2_diff || 0), 0) /
      comparison.length;

    const totalRecords = comparison.reduce(
      (sum, row) => sum + row.total_records,
      0
    );

    markdown += `| **AVERAGE**${"".padEnd(6)} | ${formatNum(avgDepartureMaeA).padStart(13)} | ${formatNum(avgDepartureMaeB).padStart(8)} | ${formatDiff(avgDepartureMaeDiff).padStart(8)} | ${formatNum(avgDepartureR2A).padStart(12)} | ${formatNum(avgDepartureR2B).padStart(7)} | ${formatDiff(avgDepartureR2Diff).padStart(7)} | ${formatNum(avgArrivalMaeA).padStart(11)} | ${formatNum(avgArrivalMaeB).padStart(8)} | ${formatDiff(avgArrivalMaeDiff).padStart(8)} | ${formatNum(avgArrivalR2A).padStart(10)} | ${formatNum(avgArrivalR2B).padStart(7)} | ${formatDiff(avgArrivalR2Diff).padStart(7)} | ${totalRecords.toString().padStart(7)} |\n`;
  }

  // Calculate summary statistics
  const validDepartureMae = comparison
    .filter((r) => r.departure_mae_diff != null)
    .map((r) => r.departure_mae_diff);
  const validDepartureR2 = comparison
    .filter((r) => r.departure_r2_diff != null)
    .map((r) => r.departure_r2_diff);
  const validArrivalMae = comparison
    .filter((r) => r.arrival_mae_diff != null)
    .map((r) => r.arrival_mae_diff);
  const validArrivalR2 = comparison
    .filter((r) => r.arrival_r2_diff != null)
    .map((r) => r.arrival_r2_diff);

  markdown += "\n## Summary Statistics\n\n";

  markdown += "### Departure Model\n";
  markdown += `**Average MAE difference:** ${validDepartureMae.reduce((a, b) => a + b, 0) / validDepartureMae.length > 0 ? "+" : ""}${(validDepartureMae.reduce((a, b) => a + b, 0) / validDepartureMae.length).toFixed(3)}\n`;
  markdown += `**Average R² difference:** ${validDepartureR2.reduce((a, b) => a + b, 0) / validDepartureR2.length > 0 ? "+" : ""}${(validDepartureR2.reduce((a, b) => a + b, 0) / validDepartureR2.length).toFixed(3)}\n`;
  markdown += `**Better MAE performance (${fileBLabel}):** ${validDepartureMae.filter((d) => d < 0).length}/${validDepartureMae.length} terminal pairs\n`;
  markdown += `**Better R² performance (${fileBLabel}):** ${validDepartureR2.filter((d) => d > 0).length}/${validDepartureR2.length} terminal pairs\n`;

  markdown += "\n### Arrival Model\n";
  markdown += `**Average MAE difference:** ${validArrivalMae.reduce((a, b) => a + b, 0) / validArrivalMae.length > 0 ? "+" : ""}${(validArrivalMae.reduce((a, b) => a + b, 0) / validArrivalMae.length).toFixed(3)}\n`;
  markdown += `**Average R² difference:** ${validArrivalR2.reduce((a, b) => a + b, 0) / validArrivalR2.length > 0 ? "+" : ""}${(validArrivalR2.reduce((a, b) => a + b, 0) / validArrivalR2.length).toFixed(3)}\n`;
  markdown += `**Better MAE performance (${fileBLabel}):** ${validArrivalMae.filter((d) => d < 0).length}/${validArrivalMae.length} terminal pairs\n`;
  markdown += `**Better R² performance (${fileBLabel}):** ${validArrivalR2.filter((d) => d > 0).length}/${validArrivalR2.length} terminal pairs\n`;

  // Overall recommendation
  const departureBetterCount = validDepartureMae.filter((d) => d < 0).length;
  const arrivalBetterCount = validArrivalMae.filter((d) => d < 0).length;
  const totalRoutes = validDepartureMae.length;
  const betterRoutes = departureBetterCount + arrivalBetterCount;

  markdown += "\n## Comparison Summary\n\n";
  markdown += `Out of ${totalRoutes} routes tested with sufficient data (≥100 records):\n`;
  markdown += `- ${betterRoutes} route-model combinations perform better with ${fileBLabel}\n`;
  markdown += `- ${totalRoutes * 2 - betterRoutes} route-model combinations perform better with ${fileALabel}\n\n`;

  if (betterRoutes > totalRoutes) {
    markdown += `**RECOMMENDATION:** ${fileBLabel} performs better overall\n`;
  } else {
    markdown += `**RECOMMENDATION:** ${fileALabel} performs better overall\n`;
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
