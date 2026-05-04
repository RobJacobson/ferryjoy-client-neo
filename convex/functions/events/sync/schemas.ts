/**
 * Convex validators for dock-event reload action and mutation boundaries.
 *
 * Runtime schemas live in the function layer so domain modules can operate on
 * plain TypeScript records without importing Convex validator code.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "../eventsScheduled/schemas";

export const dockBoundaryEventRecordSchema = v.object({
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

export type ConvexDockBoundaryEventRecord = Infer<
  typeof dockBoundaryEventRecordSchema
>;
