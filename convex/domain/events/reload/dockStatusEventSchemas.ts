/**
 * Convex validators and inferred types for internal dock-event reseed mutation
 * args and return payload. These are not database table schemas; args describe
 * hydrated dock status event rows passed from the reload action into
 * reseedDockStatusEventsForSailingDay, and the day-count return shape matches the
 * mutation returns validator.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "functions/events/common/schemas";

const dockStatusEventRecordArgs = v.object({
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

const reseedDockStatusEventsForSailingDayArgsSchema = v.object({
  SailingDay: v.string(),
  Events: v.array(dockStatusEventRecordArgs),
});

const reseedDockEventsDayCountReturnSchema = v.object({
  scheduledCount: v.number(),
  actualCount: v.number(),
});

type DockStatusEventRecord = Infer<typeof dockStatusEventRecordArgs>;

type ReseedDockStatusEventsForSailingDayArgs = Infer<
  typeof reseedDockStatusEventsForSailingDayArgsSchema
>;

type ReloadDockDayCountResult = Infer<
  typeof reseedDockEventsDayCountReturnSchema
>;

export type {
  DockStatusEventRecord,
  ReloadDockDayCountResult,
  ReseedDockStatusEventsForSailingDayArgs,
};

export {
  dockStatusEventRecordArgs,
  reseedDockEventsDayCountReturnSchema,
  reseedDockStatusEventsForSailingDayArgsSchema,
};
