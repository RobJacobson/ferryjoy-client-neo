/**
 * Defines the Convex schemas and conversion helpers shared by VesselTimeline.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  optionalDateToEpochMs,
  optionalEpochMsToDate,
} from "../../shared/convertDates";
import { eventsActualSchema } from "../eventsActual/schemas";
import { eventsScheduledSchema, boundaryEventTypeSchema } from "../eventsScheduled/schemas";

export const timelinePredictedBoundaryEventSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  PredictedTime: v.number(),
});

export const mergedTimelineBoundaryEventSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  ScheduledTime: v.optional(v.number()),
  PredictedTime: v.optional(v.number()),
  ActualTime: v.optional(v.number()),
});

export const vesselTimelineSegmentEventSchema = v.object({
  Key: v.string(),
  ScheduledDeparture: v.optional(v.number()),
  TerminalAbbrev: v.optional(v.string()),
  EventType: v.optional(boundaryEventTypeSchema),
  TerminalDisplayName: v.optional(v.string()),
  IsArrivalPlaceholder: v.optional(v.boolean()),
  ScheduledTime: v.optional(v.number()),
  PredictedTime: v.optional(v.number()),
  ActualTime: v.optional(v.number()),
});

export const vesselTimelinePlaceholderReasonSchema = v.union(
  v.literal("start-of-day"),
  v.literal("broken-seam")
);

export const vesselTimelineSegmentSchema = v.object({
  id: v.string(),
  segmentIndex: v.number(),
  kind: v.union(v.literal("dock"), v.literal("sea")),
  isTerminal: v.optional(v.boolean()),
  placeholderReason: v.optional(vesselTimelinePlaceholderReasonSchema),
  startEvent: vesselTimelineSegmentEventSchema,
  endEvent: vesselTimelineSegmentEventSchema,
  durationMinutes: v.number(),
});

export type ConvexTimelinePredictedBoundaryEvent = Infer<
  typeof timelinePredictedBoundaryEventSchema
>;
export type ConvexMergedTimelineBoundaryEvent = Infer<
  typeof mergedTimelineBoundaryEventSchema
>;
export type ConvexVesselTimelineSegmentEvent = Infer<
  typeof vesselTimelineSegmentEventSchema
>;
export type ConvexVesselTimelineSegment = Infer<
  typeof vesselTimelineSegmentSchema
>;

export const toDomainTimelinePredictedBoundaryEvent = (
  event: ConvexTimelinePredictedBoundaryEvent
) => ({
  ...event,
  ScheduledDeparture: new Date(event.ScheduledDeparture),
  PredictedTime: new Date(event.PredictedTime),
});

export const toConvexVesselTimelineSegmentEvent = (event: {
  Key: string;
  ScheduledDeparture?: Date;
  TerminalAbbrev?: string;
  EventType?: "dep-dock" | "arv-dock";
  TerminalDisplayName?: string;
  IsArrivalPlaceholder?: boolean;
  ScheduledTime?: Date;
  PredictedTime?: Date;
  ActualTime?: Date;
}): ConvexVesselTimelineSegmentEvent => ({
  ...event,
  ScheduledDeparture: optionalDateToEpochMs(event.ScheduledDeparture),
  ScheduledTime: optionalDateToEpochMs(event.ScheduledTime),
  PredictedTime: optionalDateToEpochMs(event.PredictedTime),
  ActualTime: optionalDateToEpochMs(event.ActualTime),
});

export const toDomainVesselTimelineSegmentEvent = (
  event: ConvexVesselTimelineSegmentEvent
) => ({
  ...event,
  ScheduledDeparture: optionalEpochMsToDate(event.ScheduledDeparture),
  ScheduledTime: optionalEpochMsToDate(event.ScheduledTime),
  PredictedTime: optionalEpochMsToDate(event.PredictedTime),
  ActualTime: optionalEpochMsToDate(event.ActualTime),
});

export const toDomainVesselTimelineSegment = (
  segment: ConvexVesselTimelineSegment
) => ({
  ...segment,
  startEvent: toDomainVesselTimelineSegmentEvent(segment.startEvent),
  endEvent: toDomainVesselTimelineSegmentEvent(segment.endEvent),
});

export const toDomainMergedTimelineBoundaryEvent = (
  event: ConvexMergedTimelineBoundaryEvent
) => ({
  ...event,
  ScheduledDeparture: new Date(event.ScheduledDeparture),
  ScheduledTime: optionalEpochMsToDate(event.ScheduledTime),
  PredictedTime: optionalEpochMsToDate(event.PredictedTime),
  ActualTime: optionalEpochMsToDate(event.ActualTime),
});

export type TimelinePredictedBoundaryEvent = ReturnType<
  typeof toDomainTimelinePredictedBoundaryEvent
>;
export type VesselTimelineSegmentEvent = ReturnType<
  typeof toDomainVesselTimelineSegmentEvent
>;
export type VesselTimelineSegment = ReturnType<
  typeof toDomainVesselTimelineSegment
>;
export type MergedTimelineBoundaryEvent = ReturnType<
  typeof toDomainMergedTimelineBoundaryEvent
>;

export { eventsScheduledSchema, eventsActualSchema };
