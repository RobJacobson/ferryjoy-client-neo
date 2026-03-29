/**
 * Shared effect shape for trip-driven `eventsActual` projection.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { vesselTimelineEventTypeSchema } from "./eventRecordSchemas";

export const actualBoundaryEffectSchema = v.object({
  SegmentKey: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: vesselTimelineEventTypeSchema,
  EventActualTime: v.number(),
});

export type ConvexActualBoundaryEffect = Infer<
  typeof actualBoundaryEffectSchema
>;
