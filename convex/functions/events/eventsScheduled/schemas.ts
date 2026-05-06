/**
 * Convex validators and wire types for `eventsScheduled`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { type DockEventType, dockEventTypeSchema } from "../common/schemas";

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
export type { DockEventType };
export { dockEventTypeSchema };
