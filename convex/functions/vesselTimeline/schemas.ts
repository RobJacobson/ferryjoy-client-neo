/**
 * Defines the Convex schemas and conversion helpers shared by VesselTimeline.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { eventsActualSchema } from "../eventsActual/schemas";
import { eventsPredictedSchema } from "../eventsPredicted/schemas";
import { boundaryEventTypeSchema, eventsScheduledSchema } from "../eventsScheduled/schemas";
import {
  optionalDateToEpochMs,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

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

export const vesselTimelineSnapshotEventSchema = v.object({
  Key: v.string(),
  ScheduledDeparture: v.optional(v.number()),
  TerminalAbbrev: v.optional(v.string()),
  EventType: v.optional(v.union(v.literal("dep-dock"), v.literal("arv-dock"))),
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
  startEvent: vesselTimelineSnapshotEventSchema,
  endEvent: vesselTimelineSnapshotEventSchema,
  durationMinutes: v.number(),
});

export const vesselTimelineSnapshotSchema = v.object({
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  SchemaVersion: v.number(),
  GeneratedAt: v.number(),
  Segments: v.array(vesselTimelineSegmentSchema),
});

export type ConvexVesselTimelineSnapshotEvent = Infer<
  typeof vesselTimelineSnapshotEventSchema
>;
export type ConvexVesselTimelineSegment = Infer<
  typeof vesselTimelineSegmentSchema
>;
export type ConvexVesselTimelineSnapshot = Infer<
  typeof vesselTimelineSnapshotSchema
>;
export type ConvexMergedTimelineBoundaryEvent = Infer<
  typeof mergedTimelineBoundaryEventSchema
>;

export const toConvexVesselTimelineSnapshotEvent = (event: {
  Key: string;
  ScheduledDeparture?: Date;
  TerminalAbbrev?: string;
  EventType?: "dep-dock" | "arv-dock";
  TerminalDisplayName?: string;
  IsArrivalPlaceholder?: boolean;
  ScheduledTime?: Date;
  PredictedTime?: Date;
  ActualTime?: Date;
}): ConvexVesselTimelineSnapshotEvent => ({
  ...event,
  ScheduledDeparture: optionalDateToEpochMs(event.ScheduledDeparture),
  ScheduledTime: optionalDateToEpochMs(event.ScheduledTime),
  PredictedTime: optionalDateToEpochMs(event.PredictedTime),
  ActualTime: optionalDateToEpochMs(event.ActualTime),
});

export const toDomainVesselTimelineSnapshotEvent = (
  event: ConvexVesselTimelineSnapshotEvent
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
  startEvent: toDomainVesselTimelineSnapshotEvent(segment.startEvent),
  endEvent: toDomainVesselTimelineSnapshotEvent(segment.endEvent),
});

export const toDomainVesselTimelineSnapshot = (
  snapshot: ConvexVesselTimelineSnapshot
) => ({
  ...snapshot,
  GeneratedAt: new Date(snapshot.GeneratedAt),
  Segments: snapshot.Segments.map(toDomainVesselTimelineSegment),
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

export type VesselTimelineSnapshotEvent = ReturnType<
  typeof toDomainVesselTimelineSnapshotEvent
>;
export type VesselTimelineSegment = ReturnType<
  typeof toDomainVesselTimelineSegment
>;
export type VesselTimelineSnapshot = ReturnType<
  typeof toDomainVesselTimelineSnapshot
>;
export type MergedTimelineBoundaryEvent = ReturnType<
  typeof toDomainMergedTimelineBoundaryEvent
>;

export { eventsScheduledSchema, eventsActualSchema, eventsPredictedSchema };
