/**
 * Validators and types for `modelParameters` documents and PascalCase ML prediction
 * kinds used alongside `eventsPredicted`. Imports domain `MODEL_KEYS` so Convex
 * storage and training pipeline literals stay aligned.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { MODEL_KEYS, type ModelType } from "domain/ml/shared/types";

/**
 * Convex validator union for trained-model `modelType` values.
 *
 * Mirrors `MODEL_KEYS` from domain so training code and Convex storage cannot drift.
 */
export const modelTypeValidator = v.union(
  v.literal(MODEL_KEYS[0]),
  v.literal(MODEL_KEYS[1]),
  v.literal(MODEL_KEYS[2]),
  v.literal(MODEL_KEYS[3]),
  v.literal(MODEL_KEYS[4])
);

/**
 * Domain `ModelType` re-export; use with `modelTypeValidator` for consistent typing.
 */
export type { ModelType };

/**
 * PascalCase labels for ML prediction kinds on vessel trips and `eventsPredicted`.
 */
export type PredictionType =
  | "AtDockDepartCurr"
  | "AtDockArriveNext"
  | "AtDockDepartNext"
  | "AtSeaArriveNext"
  | "AtSeaDepartNext";

/**
 * Convex validator for PascalCase prediction kinds on trips and `eventsPredicted`.
 *
 * Aligns with domain `PredictionType` naming used in ML overlays and persistence.
 */
export const predictionTypeValidator = v.union(
  v.literal("AtDockDepartCurr"),
  v.literal("AtDockArriveNext"),
  v.literal("AtDockDepartNext"),
  v.literal("AtSeaArriveNext"),
  v.literal("AtSeaDepartNext")
);

/**
 * Convex validator for one `modelParameters` training snapshot row.
 *
 * Holds linear-regression coefficients, intercept, test metrics, sampling stats,
 * and a `versionTag` for production vs dev promotion flows.
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

  // Free-form snapshot labels ("dev-temp", "prod-1", …) for promotion workflows.
  versionTag: v.string(),
});

/**
 * Inferred document shape for `modelParameters` rows (Convex-validated).
 */
export type ConvexModelParameters = Infer<typeof modelParametersSchema>;
