import * as fs from "node:fs";
import * as path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { ConvexModelParameters } from "../../convex/functions/predictions/schemas";

type BucketType = "chain" | "pair";

const DEV_TEMP_VERSION_TAG = "dev-temp";
const MODEL_TYPES_PER_BUCKET = 5;

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

  // For a single training run (dev-temp), bucketStats should be identical across
  // model types for the same bucket. If not, something is stale or inconsistent.
  if (row.total_records !== model.bucketStats.totalRecords) {
    throw new Error(
      [
        "Inconsistent total_records across model types for bucket.",
        `bucket=${key}`,
        `existing=${row.total_records}`,
        `incoming=${model.bucketStats.totalRecords}`,
        `incoming_modelType=${model.modelType}`,
        `incoming_versionTag=${model.versionTag}`,
        `incoming_createdAt=${new Date(model.createdAt).toISOString()}`,
      ].join(" ")
    );
  }
  if (row.sampled_records !== model.bucketStats.sampledRecords) {
    throw new Error(
      [
        "Inconsistent sampled_records across model types for bucket.",
        `bucket=${key}`,
        `existing=${row.sampled_records}`,
        `incoming=${model.bucketStats.sampledRecords}`,
        `incoming_modelType=${model.modelType}`,
        `incoming_versionTag=${model.versionTag}`,
        `incoming_createdAt=${new Date(model.createdAt).toISOString()}`,
      ].join(" ")
    );
  }

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

/**
 * Summarize model type coverage for dev-temp export.
 *
 * @param models - Model parameter documents to export
 * @returns Coverage summary information for logging/diagnostics
 */
const getCoverageSummary = (
  models: ConvexModelParameters[]
): {
  bucketCount: number;
  incompleteBuckets: Array<{
    bucketType: string;
    bucketKey: string;
    modelTypesPresent: string[];
  }>;
} => {
  const bucketToTypes = new Map<string, Set<string>>();
  for (const m of models) {
    const bucketKey = m.pairKey;
    if (!bucketKey) {
      continue;
    }
    const key = `${m.bucketType}|${bucketKey}`;
    const existing = bucketToTypes.get(key);
    if (existing) {
      existing.add(m.modelType);
    } else {
      bucketToTypes.set(key, new Set([m.modelType]));
    }
  }

  const incompleteBuckets = Array.from(bucketToTypes.entries())
    .map(([key, types]) => {
      const [bucketType, bucketKey] = key.split("|");
      return {
        bucketType,
        bucketKey,
        modelTypesPresent: Array.from(types).sort(),
        modelTypeCount: types.size,
      };
    })
    .filter((b) => b.modelTypeCount !== MODEL_TYPES_PER_BUCKET)
    .sort((a, b) =>
      `${a.bucketType}|${a.bucketKey}`.localeCompare(
        `${b.bucketType}|${b.bucketKey}`
      )
    )
    .map(({ bucketType, bucketKey, modelTypesPresent }) => ({
      bucketType,
      bucketKey,
      modelTypesPresent,
    }));

  return {
    bucketCount: bucketToTypes.size,
    incompleteBuckets,
  };
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
    api.functions.predictions.queries.getModelParametersByTag,
    { versionTag: DEV_TEMP_VERSION_TAG }
  );

  console.log(
    `Found ${models.length} model records (versionTag=${DEV_TEMP_VERSION_TAG})`
  );

  if (models.length % MODEL_TYPES_PER_BUCKET !== 0) {
    console.warn(
      [
        "Warning: dev-temp model record count is not a multiple of",
        MODEL_TYPES_PER_BUCKET,
        "(expected one model per bucket per modelType).",
        "This can indicate a partial training run or stale dev-temp docs.",
      ].join(" ")
    );
  }

  const coverage = getCoverageSummary(models as ConvexModelParameters[]);
  if (coverage.incompleteBuckets.length > 0) {
    console.warn(
      [
        "Warning: some buckets do not have a full set of model types for dev-temp.",
        `incompleteBuckets=${coverage.incompleteBuckets.length}`,
      ].join(" ")
    );
    for (const b of coverage.incompleteBuckets.slice(0, 10)) {
      console.warn("Incomplete bucket", b);
    }
    if (coverage.incompleteBuckets.length > 10) {
      console.warn(
        `...and ${coverage.incompleteBuckets.length - 10} more incomplete buckets`
      );
    }
  }

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
