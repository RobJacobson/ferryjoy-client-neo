import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";
import { api } from "../convex/_generated/api";
import type { ConvexModelParameters } from "../convex/functions/predictions/schemas";

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

async function exportTrainingResults() {
  // Use the production Convex URL for data export (not localhost dev server)
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log("Exporting training results...");
  console.log(`Using Convex deployment: ${convexUrl}`);
  console.log(
    "Make sure your Convex dev server is running with: npm run convex:dev"
  );

  // Initialize Convex client
  const convex = new ConvexHttpClient(convexUrl);

  // Query all model parameters
  const models = await convex.query(
    api.functions.predictions.queries.getAllModelParameters
  );

  console.log(`Found ${models.length} model records`);

  // Group by terminal pair
  const pairMap = new Map<string, TrainingResultRow>();

  models.forEach((model: ConvexModelParameters) => {
    const pairKey = `${model.departingTerminalAbbrev}->${model.arrivingTerminalAbbrev}`;

    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, {
        terminal_pair: pairKey,
        total_records: model.bucketStats?.totalRecords || 0,
        filtered_records: model.bucketStats?.filteredRecords || 0,
        mean_departure_delay:
          model.bucketStats?.meanDepartureDelay ||
          model.bucketStats?.meanAtDockDuration,
        mean_at_sea_duration: model.bucketStats?.meanAtSeaDuration,
        created_at: new Date(model.createdAt).toISOString(),
      });
    }

    // Add model-specific data
    const pairResult = pairMap.get(pairKey);
    if (!pairResult) {
      console.warn(`No pair result found for ${pairKey}`);
      return;
    }

    const metrics = model.trainingMetrics;
    if (model.modelType === "arrive-depart") {
      pairResult.arrive_depart_mae = metrics?.mae;
      pairResult.arrive_depart_r2 = metrics?.r2;
      pairResult.arrive_depart_rmse = metrics?.rmse;
      pairResult.arrive_depart_std_dev = metrics?.stdDev;
    } else if (model.modelType === "arrive-depart-late") {
      pairResult.arrive_depart_late_mae = metrics?.mae;
      pairResult.arrive_depart_late_r2 = metrics?.r2;
      pairResult.arrive_depart_late_rmse = metrics?.rmse;
      pairResult.arrive_depart_late_std_dev = metrics?.stdDev;
    } else if (model.modelType === "depart-arrive") {
      pairResult.depart_arrive_mae = metrics?.mae;
      pairResult.depart_arrive_r2 = metrics?.r2;
      pairResult.depart_arrive_rmse = metrics?.rmse;
      pairResult.depart_arrive_std_dev = metrics?.stdDev;
    } else if (model.modelType === "arrive-arrive") {
      pairResult.arrive_arrive_mae = metrics?.mae;
      pairResult.arrive_arrive_r2 = metrics?.r2;
      pairResult.arrive_arrive_rmse = metrics?.rmse;
      pairResult.arrive_arrive_std_dev = metrics?.stdDev;
    } else if (model.modelType === "depart-depart") {
      pairResult.depart_depart_mae = metrics?.mae;
      pairResult.depart_depart_r2 = metrics?.r2;
      pairResult.depart_depart_rmse = metrics?.rmse;
      pairResult.depart_depart_std_dev = metrics?.stdDev;
    }
  });

  // Convert to array and sort
  const results = Array.from(pairMap.values()).sort((a, b) =>
    a.terminal_pair.localeCompare(b.terminal_pair)
  );

  console.log(`Processed ${results.length} terminal pairs`);

  // Generate CSV
  const csvContent = generateCSV(results);

  // Write to file
  const outputPath = path.join(process.cwd(), "ml", "training-results.csv");
  fs.writeFileSync(outputPath, csvContent);

  console.log(`✅ Exported ${results.length} terminal pairs to ${outputPath}`);
}

function generateCSV(results: TrainingResultRow[]): string {
  const headers = [
    "terminal_pair",
    "arrive_depart_mae",
    "arrive_depart_r2",
    "arrive_depart_rmse",
    "arrive_depart_std_dev",
    "arrive_depart_late_mae",
    "arrive_depart_late_r2",
    "arrive_depart_late_rmse",
    "arrive_depart_late_std_dev",
    "depart_arrive_mae",
    "depart_arrive_r2",
    "depart_arrive_rmse",
    "depart_arrive_std_dev",
    "arrive_arrive_mae",
    "arrive_arrive_r2",
    "arrive_arrive_rmse",
    "arrive_arrive_std_dev",
    "depart_depart_mae",
    "depart_depart_r2",
    "depart_depart_rmse",
    "depart_depart_std_dev",
    "total_records",
    "filtered_records",
    "mean_departure_delay",
    "mean_at_sea_duration",
    "created_at",
  ];

  const rows = [
    headers.join(","),
    ...results.map((row) =>
      headers
        .map((header) => {
          const value = row[header as keyof TrainingResultRow];
          return value === undefined || value === null ? "" : String(value);
        })
        .join(",")
    ),
  ];

  return rows.join("\n");
}

// Run if called directly
if (require.main === module) {
  exportTrainingResults().catch(console.error);
}
