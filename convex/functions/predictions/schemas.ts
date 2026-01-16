import type { Infer } from "convex/values";
import { v } from "convex/values";
import { MODEL_KEYS, type ModelType } from "domain/ml/shared/types";

/**
 * Convex validator for model types, derived from MODEL_KEYS to ensure consistency
 */
export const modelTypeValidator = v.union(
  v.literal(MODEL_KEYS[0]),
  v.literal(MODEL_KEYS[1]),
  v.literal(MODEL_KEYS[2]),
  v.literal(MODEL_KEYS[3]),
  v.literal(MODEL_KEYS[4])
);

// Re-export ModelType for convenience
export type { ModelType };

/**
 * PascalCase prediction type for use in the predictions table
 */
export type PredictionType =
  | "AtDockDepartCurr"
  | "AtDockArriveNext"
  | "AtDockDepartNext"
  | "AtSeaArriveNext"
  | "AtSeaDepartNext";

/**
 * Convex validator for PascalCase prediction types (used in predictions table)
 */
export const predictionTypeValidator = v.union(
  v.literal("AtDockDepartCurr"),
  v.literal("AtDockArriveNext"),
  v.literal("AtDockDepartNext"),
  v.literal("AtSeaArriveNext"),
  v.literal("AtSeaDepartNext")
);

/**
 * Convex validator for ML model parameters stored in the modelParameters table
 * Contains trained linear regression models with coefficients, intercept, and performance metrics
 */
export const modelParametersSchema = v.object({
  bucketType: v.union(v.literal("pair")),
  pairKey: v.optional(v.string()), // present when bucketType === "pair"

  modelType: modelTypeValidator,

  featureKeys: v.array(v.string()),
  coefficients: v.array(v.number()),
  intercept: v.number(),

  testMetrics: v.object({
    mae: v.number(),
    rmse: v.number(),
    r2: v.number(),
    stdDev: v.number(),
  }),

  createdAt: v.number(),

  bucketStats: v.object({
    totalRecords: v.number(),
    sampledRecords: v.number(),
  }),

  // Versioning field - arbitrary string tag (e.g., "dev-temp", "dev-1", "prod-1")
  versionTag: v.string(),
});

export type ConvexModelParameters = Infer<typeof modelParametersSchema>;

/**
 * Convex validator for prediction records stored in the predictions table.
 * Stores one completed prediction per row when Actual becomes known.
 */
export const predictionRecordSchema = v.object({
  // Trip identification
  Key: v.string(),
  VesselAbbreviation: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.string(),
  PredictionType: predictionTypeValidator,
  // Trip timing fields (optional, may not all be available)
  TripStart: v.optional(v.number()),
  ScheduledDeparture: v.optional(v.number()),
  LeftDock: v.optional(v.number()),
  TripEnd: v.optional(v.number()),
  // Prediction times (epoch ms, rounded to seconds)
  MinTime: v.number(),
  PredTime: v.number(),
  MaxTime: v.number(),
  // Model performance metrics (from training, in minutes)
  MAE: v.number(), // Mean Absolute Error
  StdDev: v.number(), // Standard deviation of errors
  // Actual time (epoch ms, rounded to seconds)
  Actual: v.number(),
  // Delta calculations (minutes, rounded to 1/10)
  DeltaTotal: v.number(),
  DeltaRange: v.number(),
});

/**
 * Type for prediction record in Convex storage
 */
export type ConvexPredictionRecord = Infer<typeof predictionRecordSchema>;

/**
 * Convex validator for ML configuration stored in the modelConfig table.
 * Stores runtime configuration values like the active production version tag.
 */
export const modelConfigSchema = v.object({
  key: v.literal("productionVersionTag"), // Singleton key for this config
  productionVersionTag: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

export type ConvexModelConfig = Infer<typeof modelConfigSchema>;
