/**
 * Validators and types for `eventsPredicted`: persisted rows and trip-driven
 * dock write batches.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { predictionTypeValidator } from "../predictions/schemas";

export const predictionSourceSchema = v.union(
  v.literal("ml"),
  v.literal("wsf_eta")
);

export type ConvexPredictionSource = Infer<typeof predictionSourceSchema>;

/**
 * Shared field validators for **persisted** prediction rows and for each row
 * inside a {@link predictedDockWriteBatchSchema}.
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
 * Convex validator for one **persisted** `eventsPredicted` document.
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
 * Batch write input: vessel/day scope, authoritative key set, replacement rows.
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

/**
 * Map key / dedupe id for one `eventsPredicted` row: `Key`, prediction type,
 * and source. Keep in sync with `projectPredictedDockWriteBatches` and timeline
 * dedupe (`normalizedEvents`).
 *
 * @param row - Row identity fields only
 * @returns Single string for `Map` lookups
 */
export const predictedDockCompositeKey = (row: {
  Key: string;
  PredictionType: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionType}|${row.PredictionSource}`;
