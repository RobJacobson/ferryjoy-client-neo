/**
 * Shared boundary-event record schema used transiently while composing
 * schedule, actual, and predicted data for VesselTimeline.
 */
import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

export const vesselTimelineEventTypeSchema = v.union(
  v.literal("dep-dock"),
  v.literal("arv-dock")
);

export const vesselTimelineEventRecordSchema = v.object({
  SegmentKey: v.string(),
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: vesselTimelineEventTypeSchema,
  EventScheduledTime: v.optional(v.number()),
  EventPredictedTime: v.optional(v.number()),
  EventActualTime: v.optional(v.number()),
});

export type VesselTimelineEventType = Infer<typeof vesselTimelineEventTypeSchema>;
export type ConvexVesselTimelineEventRecord = Infer<
  typeof vesselTimelineEventRecordSchema
>;

export const toDomainVesselTimelineEventRecord = (
  event: ConvexVesselTimelineEventRecord
) => ({
  ...event,
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(event.EventPredictedTime),
  EventActualTime: optionalEpochMsToDate(event.EventActualTime),
});

export type VesselTimelineEventRecord = ReturnType<
  typeof toDomainVesselTimelineEventRecord
>;
