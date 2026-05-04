/**
 * Defines TS-native actual-events DTOs and converters for functions callers.
 */

import { epochMsToDate } from "../../../shared/convertDates";
import type { ConvexActualDockEvent } from "./schemas";

/**
 * Converts a wire actual dock event to the TS-native Date-shaped DTO.
 *
 * @param convexActualDockEvent - Actual event with epoch-ms time fields
 * @returns Actual event with Date time fields
 */
const toActualDockEvent = (convexActualDockEvent: ConvexActualDockEvent) => ({
  ...convexActualDockEvent,
  EventOccurred: convexActualDockEvent.EventOccurred ?? true,
  UpdatedAt: epochMsToDate(convexActualDockEvent.UpdatedAt),
  ScheduledDeparture: epochMsToDate(convexActualDockEvent.ScheduledDeparture),
  EventActualTime:
    convexActualDockEvent.EventActualTime !== undefined
      ? epochMsToDate(convexActualDockEvent.EventActualTime)
      : undefined,
});

/**
 * TS-native actual dock event with Date time fields.
 */
type ActualDockEvent = ReturnType<typeof toActualDockEvent>;

export type { ActualDockEvent };
export { toActualDockEvent };
