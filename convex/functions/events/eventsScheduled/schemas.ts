/**
 * Convex validators and wire types for eventsScheduled.
 *
 * The scheduled table stores planned dock boundary rows derived from official
 * schedule data. Query and table definitions import this schema directly.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { type DockEventType, dockEventTypeSchema } from "../common/schemas";

const eventsScheduledSchema = v.object({
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

type ConvexScheduledDockEvent = Infer<typeof eventsScheduledSchema>;

export type { ConvexScheduledDockEvent, DockEventType };
export { dockEventTypeSchema, eventsScheduledSchema };
