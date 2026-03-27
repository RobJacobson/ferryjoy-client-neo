/**
 * Defines the Convex schema and conversion helpers for `eventsPredicted`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { epochMsToDate } from "../../shared/convertDates";
import { predictionTypeValidator } from "../predictions/schemas";

export const predictionSourceSchema = v.union(
  v.literal("ml"),
  v.literal("wsf_eta")
);

export const eventsPredictedSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  UpdatedAt: v.number(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventPredictedTime: v.number(),
  PredictionType: predictionTypeValidator,
  PredictionSource: predictionSourceSchema,
});

export type ConvexPredictedBoundaryEvent = Infer<typeof eventsPredictedSchema>;
export type ConvexPredictionSource = Infer<typeof predictionSourceSchema>;

/**
 * Converts a predicted boundary event into the domain shape with `Date`
 * instances.
 *
 * @param event - Predicted boundary event using epoch milliseconds
 * @returns Predicted boundary event with `Date` instances
 */
export const toDomainPredictedBoundaryEvent = (
  event: ConvexPredictedBoundaryEvent
) => ({
  ...event,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventPredictedTime: epochMsToDate(event.EventPredictedTime),
});

export type PredictedBoundaryEvent = ReturnType<
  typeof toDomainPredictedBoundaryEvent
>;
