/**
 * Defines persisted VesselTimeline event record schemas.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "../events/eventsScheduled/schemas";

export type VesselTimelineEventType = Infer<typeof dockEventTypeSchema>;

export const vesselTimelineEventRecordSchema = v.object({
  SegmentKey: v.string(),
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: dockEventTypeSchema,
  EventScheduledTime: v.optional(v.number()),
  EventPredictedTime: v.optional(v.number()),
  EventOccurred: v.optional(v.literal(true)),
  EventActualTime: v.optional(v.number()),
});

export type ConvexVesselTimelineEventRecord = Infer<
  typeof vesselTimelineEventRecordSchema
>;
export const vesselTimelineEventSchema = vesselTimelineEventRecordSchema;
export type ConvexVesselTimelineEvent = Infer<typeof vesselTimelineEventSchema>;
