/**
 * Converts persisted Convex dock-event rows (epoch ms) into domain shapes that
 * use JavaScript Date instances for client-facing or test use.
 */

import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";
import type { ConvexActualDockEvent } from "./actual/schemas";
import type { ConvexScheduledDockEvent } from "./scheduled/schemas";

/**
 * Converts an actual dock event into the domain shape with Date fields.
 *
 * The persistence layer stores all instants as epoch milliseconds; the app
 * and some tests want Date objects for formatting and comparison. This keeps
 * the field names aligned with the Convex row while only changing time types.
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
 * Converts a scheduled dock event into the domain shape with Date fields.
 *
 * Mirrors toDomainActualDockEvent for the scheduled table row shape. Optional
 * EventScheduledTime uses optionalEpochMsToDate so absent scheduled event times
 * stay undefined instead of becoming invalid dates.
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

export type ActualDockEvent = ReturnType<typeof toDomainActualDockEvent>;
export type ScheduledDockEvent = ReturnType<typeof toDomainScheduledDockEvent>;
export { toDomainActualDockEvent, toDomainScheduledDockEvent };
