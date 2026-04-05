/**
 * Defines the shared VesselTimeline Convex schemas and conversion helpers.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";
import type { ActiveTimelineInterval } from "../../shared/activeTimelineInterval";
import { predictionSourceSchema } from "../eventsPredicted/schemas";
import { boundaryEventTypeSchema } from "../eventsScheduled/schemas";
import { predictionTypeValidator } from "../predictions/schemas";

export type VesselTimelineEventType = Infer<typeof boundaryEventTypeSchema>;

export const vesselTimelineEventRecordSchema = v.object({
  SegmentKey: v.string(),
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  EventScheduledTime: v.optional(v.number()),
  EventPredictedTime: v.optional(v.number()),
  EventActualTime: v.optional(v.number()),
});

export type ConvexVesselTimelineEventRecord = Infer<
  typeof vesselTimelineEventRecordSchema
>;
export const vesselTimelineEventSchema = vesselTimelineEventRecordSchema;
export type ConvexVesselTimelineEvent = Infer<typeof vesselTimelineEventSchema>;

export const actualBoundaryEffectSchema = v.object({
  SegmentKey: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  EventActualTime: v.number(),
});

export type ConvexActualBoundaryEffect = Infer<
  typeof actualBoundaryEffectSchema
>;

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

const vesselTimelineIntervalKindSchema = v.union(
  v.literal("at-dock"),
  v.literal("at-sea")
);

export const vesselTimelineActiveIntervalSchema = v.object({
  kind: vesselTimelineIntervalKindSchema,
  startEventKey: v.union(v.string(), v.null()),
  endEventKey: v.union(v.string(), v.null()),
});

export const vesselTimelineBackboneSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  events: v.array(vesselTimelineEventSchema),
});
export type VesselTimelineActiveInterval = ActiveTimelineInterval;
export type ConvexVesselTimelineBackbone = Infer<
  typeof vesselTimelineBackboneSchema
>;

const toDomainVesselTimelineEvent = (event: ConvexVesselTimelineEvent) => ({
  ...event,
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(event.EventPredictedTime),
  EventActualTime: optionalEpochMsToDate(event.EventActualTime),
});

export const toDomainVesselTimelineBackbone = (
  backbone: ConvexVesselTimelineBackbone
) => ({
  ...backbone,
  events: backbone.events.map(toDomainVesselTimelineEvent),
});

export type VesselTimelineEvent = ReturnType<
  typeof toDomainVesselTimelineEvent
>;
export type VesselTimelineBackbone = ReturnType<
  typeof toDomainVesselTimelineBackbone
>;
