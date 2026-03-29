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
import {
  boundaryEventTypeSchema,
  eventsScheduledSchema,
} from "../eventsScheduled/schemas";

export const timelinePredictedBoundaryEventSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventPredictedTime: v.number(),
});

export const mergedTimelineBoundaryEventSchema = v.object({
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

export const vesselTimelineSegmentEventSchema = v.object({
  Key: v.string(),
  ScheduledDeparture: v.optional(v.number()),
  TerminalAbbrev: v.optional(v.string()),
  EventType: v.optional(boundaryEventTypeSchema),
  TerminalDisplayName: v.optional(v.string()),
  IsArrivalPlaceholder: v.optional(v.boolean()),
  EventScheduledTime: v.optional(v.number()),
  EventPredictedTime: v.optional(v.number()),
  EventActualTime: v.optional(v.number()),
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
  EventPredictedTime: new Date(event.EventPredictedTime),
});

export const toConvexVesselTimelineSegmentEvent = (event: {
  Key: string;
  ScheduledDeparture?: Date;
  TerminalAbbrev?: string;
  EventType?: "dep-dock" | "arv-dock";
  TerminalDisplayName?: string;
  IsArrivalPlaceholder?: boolean;
  EventScheduledTime?: Date;
  EventPredictedTime?: Date;
  EventActualTime?: Date;
}): ConvexVesselTimelineSegmentEvent => ({
  ...event,
  ScheduledDeparture: optionalDateToEpochMs(event.ScheduledDeparture),
  EventScheduledTime: optionalDateToEpochMs(event.EventScheduledTime),
  EventPredictedTime: optionalDateToEpochMs(event.EventPredictedTime),
  EventActualTime: optionalDateToEpochMs(event.EventActualTime),
});

export const toDomainVesselTimelineSegmentEvent = (
  event: ConvexVesselTimelineSegmentEvent
) => ({
  ...event,
  ScheduledDeparture: optionalEpochMsToDate(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(event.EventPredictedTime),
  EventActualTime: optionalEpochMsToDate(event.EventActualTime),
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
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(event.EventPredictedTime),
  EventActualTime: optionalEpochMsToDate(event.EventActualTime),
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

export { eventsActualSchema, eventsScheduledSchema };
