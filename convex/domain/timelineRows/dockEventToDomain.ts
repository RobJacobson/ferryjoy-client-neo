/**
 * Converts persisted Convex dock-event rows (epoch ms) into domain shapes with
 * `Date` fields for client-facing or test use.
 */

import type { ConvexActualDockEvent } from "../../functions/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "../../functions/eventsScheduled/schemas";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";

/**
 * Converts an actual dock event into the domain shape with `Date` instances.
 *
 * @param event - Actual dock event using epoch milliseconds
 * @returns Actual dock event with `Date` instances
 */
export const toDomainActualDockEvent = (event: ConvexActualDockEvent) => ({
  ...event,
  EventOccurred: event.EventOccurred ?? true,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventActualTime:
    event.EventActualTime !== undefined
      ? epochMsToDate(event.EventActualTime)
      : undefined,
});

export type ActualDockEvent = ReturnType<typeof toDomainActualDockEvent>;

/**
 * Converts a scheduled dock event into the domain shape with `Date` instances.
 *
 * @param event - Scheduled dock event using epoch milliseconds
 * @returns Scheduled dock event with `Date` instances
 */
export const toDomainScheduledDockEvent = (
  event: ConvexScheduledDockEvent
) => ({
  ...event,
  UpdatedAt: epochMsToDate(event.UpdatedAt),
  ScheduledDeparture: epochMsToDate(event.ScheduledDeparture),
  EventScheduledTime: optionalEpochMsToDate(event.EventScheduledTime),
});

export type ScheduledDockEvent = ReturnType<typeof toDomainScheduledDockEvent>;
