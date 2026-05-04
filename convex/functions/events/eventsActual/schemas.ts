/**
 * Convex validators for eventsActual plus epoch-ms to Date conversions for app use.
 * Sparse upstream shapes live under domain/events/types.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { epochMsToDate } from "../../../shared/convertDates";
import { dockEventTypeSchema } from "../eventsScheduled/schemas";

/**
 * Persisted row fields (physical TripKey required).
 */
const persistedActualDockFields = {
  TripKey: v.string(),
  ScheduleKey: v.optional(v.string()),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventActualTime: v.optional(v.number()),
} as const;

/**
 * Convex validator for one persisted eventsActual document.
 *
 * Physical identity is EventKey; EventType is first-class. Optional ScheduleKey
 * ties the row to schedule continuity without replacing physical keys.
 */
const eventsActualSchema = v.object({
  ...persistedActualDockFields,
  EventKey: v.string(),
  EventType: dockEventTypeSchema,
  UpdatedAt: v.number(),
  EventOccurred: v.optional(v.literal(true)),
});

export type ConvexActualDockEvent = Infer<typeof eventsActualSchema>;

/**
 * Converts an actual dock event into the domain shape with Date fields.
 *
 * The persistence layer stores instants as epoch milliseconds; the app and some
 * tests use Date objects for formatting and comparison.
 *
 * @param event - Actual dock event using epoch milliseconds throughout
 * @returns Actual dock event with Date instances for every time field
 */
const toDomainActualDockEvent = (event: ConvexActualDockEvent) => ({
  ...event,
  EventOccurred: event.EventOccurred ?? true,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventActualTime:
    event.EventActualTime !== undefined
      ? epochMsToDate(event.EventActualTime)
      : undefined,
});

/**
 * Domain actual dock event: same fields as stored rows with time fields as Date.
 */
export type ActualDockEvent = ReturnType<typeof toDomainActualDockEvent>;

export { eventsActualSchema, toDomainActualDockEvent };
