import * as fs from "node:fs";
import * as path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { ConvexModelParameters } from "../../convex/functions/predictions/schemas";

type BucketType = "chain" | "pair";

type TrainingResultRow = {
  bucket_type: BucketType;
  bucket_key: string; // pairKey

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

const upsertRow = (
  map: Map<string, TrainingResultRow>,
  model: ConvexModelParameters
) => {
  const bucketKey = model.pairKey;
  if (!bucketKey) {
    return;
  }

  const key = `${model.bucketType}|${bucketKey}`;
  if (!map.has(key)) {
    map.set(key, {
      bucket_type: model.bucketType,
      bucket_key: bucketKey,
      total_records: model.bucketStats.totalRecords,
      sampled_records: model.bucketStats.sampledRecords,
      created_at: new Date(model.createdAt).toISOString(),
    });
  }

  const row = map.get(key);
  if (!row) {
    return;
  }

  // Keep the most recent created_at if mixed
  if (new Date(model.createdAt).toISOString() > row.created_at) {
    row.created_at = new Date(model.createdAt).toISOString();
  }

  // Prefer max stats (in case training wrote multiple docs during experiments)
  row.total_records = Math.max(
    row.total_records,
    model.bucketStats.totalRecords
  );
  row.sampled_records = Math.max(
    row.sampled_records,
    model.bucketStats.sampledRecords
  );

  const { mae, r2, rmse, stdDev } = model.testMetrics;

  switch (model.modelType) {
    case "at-dock-depart-curr":
      row.at_dock_depart_curr_mae = mae;
      row.at_dock_depart_curr_r2 = r2;
      row.at_dock_depart_curr_rmse = rmse;
      row.at_dock_depart_curr_stddev = stdDev;
      break;
    case "at-dock-arrive-next":
      row.at_dock_arrive_next_mae = mae;
      row.at_dock_arrive_next_r2 = r2;
      row.at_dock_arrive_next_rmse = rmse;
      row.at_dock_arrive_next_stddev = stdDev;
      break;
    case "at-dock-depart-next":
      row.at_dock_depart_next_mae = mae;
      row.at_dock_depart_next_r2 = r2;
      row.at_dock_depart_next_rmse = rmse;
      row.at_dock_depart_next_stddev = stdDev;
      break;
    case "at-sea-arrive-next":
      row.at_sea_arrive_next_mae = mae;
      row.at_sea_arrive_next_r2 = r2;
      row.at_sea_arrive_next_rmse = rmse;
      row.at_sea_arrive_next_stddev = stdDev;
      break;
    case "at-sea-depart-next":
      row.at_sea_depart_next_mae = mae;
      row.at_sea_depart_next_r2 = r2;
      row.at_sea_depart_next_rmse = rmse;
      row.at_sea_depart_next_stddev = stdDev;
      break;
  }
};

const generateCSV = (results: TrainingResultRow[]): string => {
  const headers = [
    "bucket_type",
    "bucket_key",

    "at_dock_depart_curr_mae",
    "at_dock_depart_curr_r2",
    "at_dock_depart_curr_rmse",
    "at_dock_depart_curr_stddev",

    "at_dock_arrive_next_mae",
    "at_dock_arrive_next_r2",
    "at_dock_arrive_next_rmse",
    "at_dock_arrive_next_stddev",

    "at_dock_depart_next_mae",
    "at_dock_depart_next_r2",
    "at_dock_depart_next_rmse",
    "at_dock_depart_next_stddev",

    "at_sea_arrive_next_mae",
    "at_sea_arrive_next_r2",
    "at_sea_arrive_next_rmse",
    "at_sea_arrive_next_stddev",

    "at_sea_depart_next_mae",
    "at_sea_depart_next_r2",
    "at_sea_depart_next_rmse",
    "at_sea_depart_next_stddev",

    "total_records",
    "sampled_records",
    "created_at",
  ] as const;

  const rows = [
    headers.join(","),
    ...results.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          return value === undefined || value === null ? "" : String(value);
        })
        .join(",")
    ),
  ];

  return rows.join("\n");
};

async function exportTrainingResults() {
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log("Exporting training results...");
  console.log(`Using Convex deployment: ${convexUrl}`);

  const convex = new ConvexHttpClient(convexUrl);
  const models = await convex.query(
    api.functions.predictions.queries.getAllModelParameters
  );

  console.log(`Found ${models.length} model records`);

  const bucketMap = new Map<string, TrainingResultRow>();
  for (const model of models as ConvexModelParameters[]) {
    upsertRow(bucketMap, model);
  }

  const results = Array.from(bucketMap.values()).sort((a, b) => {
    if (a.bucket_type !== b.bucket_type) {
      return a.bucket_type.localeCompare(b.bucket_type);
    }
    return a.bucket_key.localeCompare(b.bucket_key);
  });

  const csvContent = generateCSV(results);

  const outputDir = path.join(process.cwd(), "ml");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "training-results.csv");
  fs.writeFileSync(outputPath, csvContent);

  console.log(`✅ Exported ${results.length} buckets to ${outputPath}`);
}

if (require.main === module) {
  exportTrainingResults().catch(console.error);
}
