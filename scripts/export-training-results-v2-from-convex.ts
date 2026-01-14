import * as fs from "node:fs";
import * as path from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { ConvexModelParametersV2 } from "../convex/functions/predictionsV2/schemas";

type TrainingResultRowV2 = {
  bucket_type: "chain" | "pair";
  bucket_key: string; // chainKey or pairKey

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

const upsertRow = (
  map: Map<string, TrainingResultRowV2>,
  model: ConvexModelParametersV2
) => {
  const bucketKey =
    model.bucketType === "chain" ? model.chainKey : model.pairKey;
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

  const { mae, r2, rmse } = model.testMetrics;

  switch (model.modelType) {
    case "in-service-at-dock-depart-b":
      row.in_service_at_dock_depart_b_mae = mae;
      row.in_service_at_dock_depart_b_r2 = r2;
      row.in_service_at_dock_depart_b_rmse = rmse;
      break;
    case "in-service-at-dock-arrive-c":
      row.in_service_at_dock_arrive_c_mae = mae;
      row.in_service_at_dock_arrive_c_r2 = r2;
      row.in_service_at_dock_arrive_c_rmse = rmse;
      break;
    case "in-service-at-dock-depart-c":
      row.in_service_at_dock_depart_c_mae = mae;
      row.in_service_at_dock_depart_c_r2 = r2;
      row.in_service_at_dock_depart_c_rmse = rmse;
      break;
    case "in-service-at-sea-arrive-c":
      row.in_service_at_sea_arrive_c_mae = mae;
      row.in_service_at_sea_arrive_c_r2 = r2;
      row.in_service_at_sea_arrive_c_rmse = rmse;
      break;
    case "in-service-at-sea-depart-c":
      row.in_service_at_sea_depart_c_mae = mae;
      row.in_service_at_sea_depart_c_r2 = r2;
      row.in_service_at_sea_depart_c_rmse = rmse;
      break;

    case "layover-at-dock-depart-b":
      row.layover_at_dock_depart_b_mae = mae;
      row.layover_at_dock_depart_b_r2 = r2;
      row.layover_at_dock_depart_b_rmse = rmse;
      break;
    case "layover-at-dock-arrive-c":
      row.layover_at_dock_arrive_c_mae = mae;
      row.layover_at_dock_arrive_c_r2 = r2;
      row.layover_at_dock_arrive_c_rmse = rmse;
      break;
    case "layover-at-dock-depart-c":
      row.layover_at_dock_depart_c_mae = mae;
      row.layover_at_dock_depart_c_r2 = r2;
      row.layover_at_dock_depart_c_rmse = rmse;
      break;
    case "layover-at-sea-arrive-c":
      row.layover_at_sea_arrive_c_mae = mae;
      row.layover_at_sea_arrive_c_r2 = r2;
      row.layover_at_sea_arrive_c_rmse = rmse;
      break;
    case "layover-at-sea-depart-c":
      row.layover_at_sea_depart_c_mae = mae;
      row.layover_at_sea_depart_c_r2 = r2;
      row.layover_at_sea_depart_c_rmse = rmse;
      break;
  }
};

const generateCSV = (results: TrainingResultRowV2[]): string => {
  const headers = [
    "bucket_type",
    "bucket_key",

    "in_service_at_dock_depart_b_mae",
    "in_service_at_dock_depart_b_r2",
    "in_service_at_dock_depart_b_rmse",

    "in_service_at_dock_arrive_c_mae",
    "in_service_at_dock_arrive_c_r2",
    "in_service_at_dock_arrive_c_rmse",

    "in_service_at_dock_depart_c_mae",
    "in_service_at_dock_depart_c_r2",
    "in_service_at_dock_depart_c_rmse",

    "in_service_at_sea_arrive_c_mae",
    "in_service_at_sea_arrive_c_r2",
    "in_service_at_sea_arrive_c_rmse",

    "in_service_at_sea_depart_c_mae",
    "in_service_at_sea_depart_c_r2",
    "in_service_at_sea_depart_c_rmse",

    "layover_at_dock_depart_b_mae",
    "layover_at_dock_depart_b_r2",
    "layover_at_dock_depart_b_rmse",

    "layover_at_dock_arrive_c_mae",
    "layover_at_dock_arrive_c_r2",
    "layover_at_dock_arrive_c_rmse",

    "layover_at_dock_depart_c_mae",
    "layover_at_dock_depart_c_r2",
    "layover_at_dock_depart_c_rmse",

    "layover_at_sea_arrive_c_mae",
    "layover_at_sea_arrive_c_r2",
    "layover_at_sea_arrive_c_rmse",

    "layover_at_sea_depart_c_mae",
    "layover_at_sea_depart_c_r2",
    "layover_at_sea_depart_c_rmse",

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

async function exportTrainingResultsV2() {
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log("Exporting v2 training results...");
  console.log(`Using Convex deployment: ${convexUrl}`);

  const convex = new ConvexHttpClient(convexUrl);
  const models = await convex.query(
    api.functions.predictionsV2.queries.getAllModelParametersV2
  );

  console.log(`Found ${models.length} v2 model records`);

  const bucketMap = new Map<string, TrainingResultRowV2>();
  for (const model of models as ConvexModelParametersV2[]) {
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

  const outputPath = path.join(outputDir, "training-results-v2.csv");
  fs.writeFileSync(outputPath, csvContent);

  console.log(`✅ Exported ${results.length} buckets to ${outputPath}`);
}

if (require.main === module) {
  exportTrainingResultsV2().catch(console.error);
}
