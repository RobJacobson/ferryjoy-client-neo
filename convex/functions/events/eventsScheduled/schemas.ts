/**
 * Convex validators for `eventsScheduled` plus epoch-ms to Date conversions for app use.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../../shared/convertDates";

export const dockEventTypeSchema = v.union(
  v.literal("dep-dock"),
  v.literal("arv-dock")
);

export type DockEventType = Infer<typeof dockEventTypeSchema>;

export const eventsScheduledSchema = v.object({
  Key: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  UpdatedAt: v.number(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  NextTerminalAbbrev: v.string(),
  EventType: dockEventTypeSchema,
  EventScheduledTime: v.optional(v.number()),
  IsLastArrivalOfSailingDay: v.optional(v.boolean()),
});

export type ConvexScheduledDockEvent = Infer<typeof eventsScheduledSchema>;

/**
 * Converts a scheduled dock event into the domain shape with Date fields.
 *
 * Optional EventScheduledTime uses optionalEpochMsToDate so absent times stay
 * undefined instead of becoming invalid dates.
 *
 * @param event - Scheduled dock event using epoch milliseconds throughout
 * @returns Scheduled dock event with Date instances for stored time fields
 */
const toDomainScheduledDockEvent = (event: ConvexScheduledDockEvent) => ({
  ...event,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
});

/**
 * Domain scheduled dock event: same fields as stored rows with time fields as Date.
 */
export type ScheduledDockEvent = ReturnType<typeof toDomainScheduledDockEvent>;

export { toDomainScheduledDockEvent };
