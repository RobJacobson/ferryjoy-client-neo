/**
 * Defines the Convex schema and conversion helpers for `eventsActual`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { epochMsToDate } from "../../shared/convertDates";

export const eventsActualSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  UpdatedAt: v.number(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventActualTime: v.number(),
});

export type ConvexActualBoundaryEvent = Infer<typeof eventsActualSchema>;

/**
 * Converts an actual boundary event into the domain shape with `Date`
 * instances.
 *
 * @param event - Actual boundary event using epoch milliseconds
 * @returns Actual boundary event with `Date` instances
 */
export const toDomainActualBoundaryEvent = (event: ConvexActualBoundaryEvent) => ({
  ...event,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventActualTime: epochMsToDate(event.EventActualTime),
});

export type ActualBoundaryEvent = ReturnType<typeof toDomainActualBoundaryEvent>;
