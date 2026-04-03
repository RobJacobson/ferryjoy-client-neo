/**
 * Defines the Convex schema and conversion helpers for `eventsScheduled`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

export const boundaryEventTypeSchema = v.union(
  v.literal("dep-dock"),
  v.literal("arv-dock")
);

export const eventsScheduledSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  UpdatedAt: v.number(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  NextTerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  EventScheduledTime: v.optional(v.number()),
});

export const inferredScheduledSegmentSchema = v.object({
  Key: v.string(),
  SailingDay: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.string(),
  DepartingTime: v.number(),
  NextKey: v.optional(v.string()),
  NextDepartingTime: v.optional(v.number()),
});

export type ConvexScheduledBoundaryEvent = Infer<typeof eventsScheduledSchema>;
export type ConvexInferredScheduledSegment = Infer<
  typeof inferredScheduledSegmentSchema
>;

/**
 * Converts a scheduled boundary event into the domain shape with `Date`
 * instances.
 *
 * @param event - Scheduled boundary event using epoch milliseconds
 * @returns Scheduled boundary event with `Date` instances
 */
export const toDomainScheduledBoundaryEvent = (
  event: ConvexScheduledBoundaryEvent
) => ({
  ...event,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
});

export type ScheduledBoundaryEvent = ReturnType<
  typeof toDomainScheduledBoundaryEvent
>;
