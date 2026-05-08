/**
 * Convex validators and payload types for dock-event reload boundaries.
 *
 * Actions convert adapter Date values into epoch milliseconds before crossing
 * into internal mutations. These validators and inferred types define that
 * boundary payload for scheduled and actual reload persistence.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "functions/events/eventsScheduled/schemas";

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

const reloadDockHistoryRecordSchema = v.object({
  VesselId: v.number(),
  Vessel: v.optional(v.string()),
  Departing: v.optional(v.string()),
  Arriving: v.optional(v.string()),
  ScheduledDepart: v.optional(v.number()),
  ActualDepart: v.optional(v.number()),
  EstArrival: v.optional(v.number()),
});

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

const reseedDockEventsForSailingDayArgsSchema = v.object({
  SailingDay: v.string(),
  Events: v.array(reloadDockBoundaryEventRecordSchema),
});

type ConvexReloadDockScheduleSegment = Infer<
  typeof reloadDockScheduleSegmentSchema
>;
type ConvexReloadDockHistoryRecord = Infer<
  typeof reloadDockHistoryRecordSchema
>;
type ConvexReloadDockBoundaryEventRecord = Infer<
  typeof reloadDockBoundaryEventRecordSchema
>;
type ReseedDockEventsForSailingDayArgs = Infer<
  typeof reseedDockEventsForSailingDayArgsSchema
>;

export type {
  ConvexReloadDockBoundaryEventRecord,
  ConvexReloadDockHistoryRecord,
  ConvexReloadDockScheduleSegment,
  ReseedDockEventsForSailingDayArgs,
};
export {
  reloadDockBoundaryEventRecordSchema,
  reseedDockEventsForSailingDayArgsSchema,
};
