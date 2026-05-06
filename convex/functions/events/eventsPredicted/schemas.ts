/**
 * Convex validators and wire types for eventsPredicted.
 *
 * The predicted table stores ETA and ML prediction rows by dock boundary,
 * prediction type, and prediction source. Write batch validators remain here
 * because the current orchestrator imports those sparse write shapes.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { predictionTypeValidator } from "functions/predictions/schemas";

const predictionSourceSchema = v.union(v.literal("ml"), v.literal("wsf_eta"));

type ConvexPredictionSource = Infer<typeof predictionSourceSchema>;

const predictedDockSharedFields = {
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventPredictedTime: v.number(),
  PredictionType: predictionTypeValidator,
  PredictionSource: predictionSourceSchema,
  Actual: v.optional(v.number()),
  DeltaTotal: v.optional(v.number()),
} as const;

const eventsPredictedSchema = v.object({
  ...predictedDockSharedFields,
  UpdatedAt: v.number(),
});

type ConvexPredictedDockEvent = Infer<typeof eventsPredictedSchema>;

const predictedDockWriteRowSchema = v.object(predictedDockSharedFields);

type ConvexPredictedDockWriteRow = Infer<typeof predictedDockWriteRowSchema>;

const predictedDockWriteBatchSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  TargetKeys: v.array(v.string()),
  Rows: v.array(predictedDockWriteRowSchema),
});

type ConvexPredictedDockWriteBatch = Infer<
  typeof predictedDockWriteBatchSchema
>;

export type {
  ConvexPredictedDockEvent,
  ConvexPredictedDockWriteBatch,
  ConvexPredictedDockWriteRow,
  ConvexPredictionSource,
};
export {
  eventsPredictedSchema,
  predictedDockWriteBatchSchema,
  predictionSourceSchema,
};
