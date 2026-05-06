/**
 * Convex validators for dock-event reload payloads.
 *
 * Actions convert adapter Date values into epoch milliseconds before crossing
 * the action-to-mutation boundary. The internal mutations then receive compact
 * numeric payloads for scheduled and actual table reloads.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";

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

const reloadDockDataSchema = v.object({
  SailingDay: v.string(),
  ScheduleSegments: v.array(reloadDockScheduleSegmentSchema),
  HistoryRecords: v.array(reloadDockHistoryRecordSchema),
});

const reloadDockScheduleDataSchema = v.object({
  SailingDay: v.string(),
  ScheduleSegments: v.array(reloadDockScheduleSegmentSchema),
});

type ConvexReloadDockScheduleSegment = Infer<
  typeof reloadDockScheduleSegmentSchema
>;
type ConvexReloadDockHistoryRecord = Infer<
  typeof reloadDockHistoryRecordSchema
>;
type ConvexReloadDockData = Infer<typeof reloadDockDataSchema>;
type ConvexReloadDockScheduleData = Infer<typeof reloadDockScheduleDataSchema>;

export type {
  ConvexReloadDockData,
  ConvexReloadDockHistoryRecord,
  ConvexReloadDockScheduleData,
  ConvexReloadDockScheduleSegment,
};
export {
  reloadDockDataSchema,
  reloadDockHistoryRecordSchema,
  reloadDockScheduleDataSchema,
  reloadDockScheduleSegmentSchema,
};
