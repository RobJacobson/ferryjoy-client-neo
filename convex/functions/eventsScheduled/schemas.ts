/**
 * Defines the Convex schema for `eventsScheduled` and inferred segment shapes.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

export const dockEventTypeSchema = v.union(
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
  EventType: dockEventTypeSchema,
  EventScheduledTime: v.optional(v.number()),
  IsLastArrivalOfSailingDay: v.optional(v.boolean()),
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

export type ConvexScheduledDockEvent = Infer<typeof eventsScheduledSchema>;
export type ConvexInferredScheduledSegment = Infer<
  typeof inferredScheduledSegmentSchema
>;
