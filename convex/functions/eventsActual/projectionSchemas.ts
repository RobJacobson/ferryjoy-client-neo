/**
 * Validators and types for trip-driven projection into `eventsActual`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { boundaryEventTypeSchema } from "../eventsScheduled/schemas";

export const actualBoundaryEffectSchema = v.object({
  SegmentKey: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventType: boundaryEventTypeSchema,
  EventActualTime: v.number(),
});

export type ConvexActualBoundaryEffect = Infer<
  typeof actualBoundaryEffectSchema
>;
