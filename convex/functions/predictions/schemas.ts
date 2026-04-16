/**
 * Shared validators and inferred types for stored ML model parameter rows.
 */

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

// Re-export the domain type so function callers can stay aligned with validators.
export type { ModelType };

/**
 * PascalCase prediction type (vessel-trip ML fields and eventsPredicted rows).
 */
export type PredictionType =
  | "AtDockDepartCurr"
  | "AtDockArriveNext"
  | "AtDockDepartNext"
  | "AtSeaArriveNext"
  | "AtSeaDepartNext";

/**
 * Convex validator for PascalCase prediction types (eventsPredicted, trips).
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
  pairKey: v.optional(v.string()), // Present when bucketType === "pair".

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

  // Arbitrary version tag such as "dev-temp", "dev-1", or "prod-1".
  versionTag: v.string(),
});

export type ConvexModelParameters = Infer<typeof modelParametersSchema>;

/**
 * Convex validator for ML configuration stored in the modelConfig table.
 * Note: This schema is deprecated and only used for migration to keyValueStore.
 * After migration, remove this schema and table.
 */
export const modelConfigSchema = v.object({
  key: v.literal("productionVersionTag"),
  productionVersionTag: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

export type ConvexModelConfig = Infer<typeof modelConfigSchema>;
