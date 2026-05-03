/**
 * Convex validators for `eventsScheduled`: planned dock boundaries (times,
 * terminals, segment keys) hydrated from schedule adapters for timelines.
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

export type ConvexScheduledDockEvent = Infer<typeof eventsScheduledSchema>;
