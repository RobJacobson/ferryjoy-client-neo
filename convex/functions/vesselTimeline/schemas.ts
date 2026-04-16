/**
 * Defines the shared VesselTimeline Convex schemas and conversion helpers.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { ActiveTimelineInterval } from "../../shared/activeTimelineInterval";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";
import { dockEventTypeSchema } from "../eventsScheduled/schemas";

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

/**
 * Convert one stored timeline event from epoch millisecond fields to domain
 * `Date` fields.
 *
 * @param event - Stored Convex vessel timeline event
 * @returns Domain timeline event with `Date`-typed timestamps
 */
const toDomainVesselTimelineEvent = (event: ConvexVesselTimelineEvent) => ({
  ...event,
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
  EventPredictedTime: optionalEpochMsToDate(event.EventPredictedTime),
  EventOccurred:
    event.EventOccurred ??
    (event.EventActualTime !== undefined ? true : undefined),
  EventActualTime: optionalEpochMsToDate(event.EventActualTime),
});

/**
 * Convert a stored timeline backbone into the domain-layer `Date`-based shape.
 *
 * @param backbone - Stored Convex vessel timeline backbone
 * @returns Domain vessel timeline backbone with converted event timestamps
 */
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
