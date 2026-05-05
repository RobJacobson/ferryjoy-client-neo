/**
 * Convex validators for the dock-event reload payload.
 *
 * The internal reload mutation crosses the action-to-mutation boundary with
 * fetched schedule and vessel-history slices in epoch-ms shape, mirroring the
 * Convex-prefixed numeric persistence types used elsewhere (for example
 * ConvexVesselLocation, ConvexScheduledTrip). Adapter fetch types still use
 * Date; conversion happens in shared convertDates helpers at the action edge
 * (Date to epoch ms) and at the mutation edge (epoch ms back to Date) so
 * domain stages can keep their existing Date-shaped inputs.
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
