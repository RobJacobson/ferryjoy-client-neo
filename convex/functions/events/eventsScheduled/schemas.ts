/**
 * Defines the Convex schema for eventsScheduled and inferred row shapes.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

export const dockEventTypeSchema = v.union(
  v.literal("dep-dock"),
  v.literal("arv-dock")
);

export type DockEventType = Infer<typeof dockEventTypeSchema>;

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

/**
 * Reload wire: numeric schedule segment row from the dock-event sync action.
 */
const reloadDockScheduleSegmentSchema = v.object({
  VesselName: v.string(),
  DepartingTerminalID: v.number(),
  ArrivingTerminalID: v.number(),
  DepartingTerminalName: v.string(),
  ArrivingTerminalName: v.string(),
  DepartingTime: v.number(),
  ArrivingTime: v.optional(v.number()),
  SailingNotes: v.string(),
  Annotations: v.array(v.string()),
  RouteID: v.number(),
  RouteAbbrev: v.string(),
  SailingDay: v.string(),
});

/**
 * Reload wire: hydrated boundary record crossing the action to mutation boundary.
 */
const reloadDockBoundaryEventRecordSchema = v.object({
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

/**
 * Reload internal mutation args: replaces scheduled and actual rows for one day.
 */
const reseedDockEventsForSailingDayArgsSchema = v.object({
  SailingDay: v.string(),
  Events: v.array(reloadDockBoundaryEventRecordSchema),
});

type ConvexReloadDockScheduleSegment = Infer<
  typeof reloadDockScheduleSegmentSchema
>;

type ConvexReloadDockBoundaryEventRecord = Infer<
  typeof reloadDockBoundaryEventRecordSchema
>;

type ReseedDockEventsForSailingDayArgs = Infer<
  typeof reseedDockEventsForSailingDayArgsSchema
>;

export type {
  ConvexReloadDockBoundaryEventRecord,
  ConvexReloadDockScheduleSegment,
  ReseedDockEventsForSailingDayArgs,
};
export {
  reloadDockBoundaryEventRecordSchema,
  reloadDockScheduleSegmentSchema,
  reseedDockEventsForSailingDayArgsSchema,
};
