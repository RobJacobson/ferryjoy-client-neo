/**
 * Validators and types for trip-driven projection into `eventsPredicted`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { predictionTypeValidator } from "../predictions/schemas";
import { predictionSourceSchema } from "./schemas";

const predictedBoundaryProjectionRowSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventPredictedTime: v.number(),
  PredictionType: predictionTypeValidator,
  PredictionSource: predictionSourceSchema,
});

export const predictedBoundaryProjectionEffectSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  TargetKeys: v.array(v.string()),
  Rows: v.array(predictedBoundaryProjectionRowSchema),
});

export type ConvexPredictedBoundaryProjectionRow = Infer<
  typeof predictedBoundaryProjectionRowSchema
>;
export type ConvexPredictedBoundaryProjectionEffect = Infer<
  typeof predictedBoundaryProjectionEffectSchema
>;
