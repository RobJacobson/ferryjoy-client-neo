/**
 * Convex validators and inferred types for internal dock-event reseed mutation
 * args and return payload. These are not database table schemas; args describe
 * hydrated boundary rows passed from the reload action into
 * reseedDockEventsForSailingDay, and the day-count return shape matches the
 * mutation returns validator.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "functions/events/common/schemas";

const reseedDockBoundaryEventRecordArgs = v.object({
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
  Events: v.array(reseedDockBoundaryEventRecordArgs),
});

const reseedDockEventsDayCountReturnSchema = v.object({
  ScheduledCount: v.number(),
  ActualCount: v.number(),
});

type DockBoundaryEventRecord = Infer<typeof reseedDockBoundaryEventRecordArgs>;

type ReseedDockBoundaryEventRecordArgs = DockBoundaryEventRecord;

type ReseedDockEventsForSailingDayArgs = Infer<
  typeof reseedDockEventsForSailingDayArgsSchema
>;

type ReloadDockDayCountResult = Infer<
  typeof reseedDockEventsDayCountReturnSchema
>;

export type {
  DockBoundaryEventRecord,
  ReloadDockDayCountResult,
  ReseedDockBoundaryEventRecordArgs,
  ReseedDockEventsForSailingDayArgs,
};
export {
  reseedDockBoundaryEventRecordArgs,
  reseedDockEventsDayCountReturnSchema,
  reseedDockEventsForSailingDayArgsSchema,
};
