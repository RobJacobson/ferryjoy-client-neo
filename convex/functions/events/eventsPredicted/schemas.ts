/**
 * Validators and types for `eventsPredicted`: persisted rows and trip-driven
 * dock write batches.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { predictionTypeValidator } from "../../predictions/schemas";

export const predictionSourceSchema = v.union(
  v.literal("ml"),
  v.literal("wsf_eta")
);

export type ConvexPredictionSource = Infer<typeof predictionSourceSchema>;

/**
 * Shared Convex fields for persisted predictions and batch write rows.
 *
 * Reused by `eventsPredicted` documents and the row shape inside write batches
 * so sparse upserts and storage use one definition.
 */
const predictedDockSharedFields = {
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventPredictedTime: v.number(),
  PredictionType: predictionTypeValidator,
  PredictionSource: predictionSourceSchema,
  /** Observed time when actualized (epoch ms). */
  Actual: v.optional(v.number()),
  /** Signed error vs PredTime in minutes when actualized. */
  DeltaTotal: v.optional(v.number()),
} as const;

/**
 * Convex validator for one persisted `eventsPredicted` document.
 *
 * Includes `UpdatedAt` and optional actualization fields on top of the shared
 * prediction payload shape.
 */
export const eventsPredictedSchema = v.object({
  ...predictedDockSharedFields,
  UpdatedAt: v.number(),
});

export type ConvexPredictedDockEvent = Infer<typeof eventsPredictedSchema>;

const predictedDockWriteRowSchema = v.object(predictedDockSharedFields);

export type ConvexPredictedDockWriteRow = Infer<
  typeof predictedDockWriteRowSchema
>;

/**
 * Convex validator for one sparse predicted-dock write batch.
 *
 * `TargetKeys` scopes deletions; `Rows` carries replacement composite keys for
 * that vessel/sailing-day slice.
 */
export const predictedDockWriteBatchSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  TargetKeys: v.array(v.string()),
  Rows: v.array(predictedDockWriteRowSchema),
});

export type ConvexPredictedDockWriteBatch = Infer<
  typeof predictedDockWriteBatchSchema
>;
