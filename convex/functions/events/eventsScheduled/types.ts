/**
 * Defines TS-native scheduled-events DTOs and converters for functions callers.
 */

import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../../shared/convertDates";
import type { ConvexScheduledDockEvent } from "./schemas";

/**
 * Converts a wire scheduled dock event to the TS-native Date-shaped DTO.
 *
 * @param convexScheduledDockEvent - Scheduled event with epoch-ms time fields
 * @returns Scheduled event with Date time fields
 */
const toScheduledDockEvent = (
  convexScheduledDockEvent: ConvexScheduledDockEvent
) => ({
  ...convexScheduledDockEvent,
  UpdatedAt: epochMsToDate(convexScheduledDockEvent.UpdatedAt),
  ScheduledDeparture: epochMsToDate(
    convexScheduledDockEvent.ScheduledDeparture
  ),
  EventScheduledTime: optionalEpochMsToDate(
    convexScheduledDockEvent.EventScheduledTime
  ),
});

/**
 * TS-native scheduled dock event with Date time fields.
 */
type ScheduledDockEvent = ReturnType<typeof toScheduledDockEvent>;

export type { ScheduledDockEvent };
export { toScheduledDockEvent };
