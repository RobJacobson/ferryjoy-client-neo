/**
 * Convex validators and inferred types for internal dock-event reseed mutation
 * args. These are not database table schemas; they describe hydrated boundary
 * rows passed from the reload action into reseedDockEventsForSailingDay.
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

type DockBoundaryEventRecord = Infer<typeof reseedDockBoundaryEventRecordArgs>;

type ReseedDockBoundaryEventRecordArgs = DockBoundaryEventRecord;

type ReseedDockEventsForSailingDayArgs = Infer<
  typeof reseedDockEventsForSailingDayArgsSchema
>;

export type {
  DockBoundaryEventRecord,
  ReseedDockBoundaryEventRecordArgs,
  ReseedDockEventsForSailingDayArgs,
};
export {
  reseedDockBoundaryEventRecordArgs,
  reseedDockEventsForSailingDayArgsSchema,
};
