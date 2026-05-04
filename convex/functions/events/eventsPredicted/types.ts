/**
 * Defines TS-native predicted-events DTOs and converters for functions callers.
 */

import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../../shared/convertDates";
import type { ConvexPredictedDockEvent } from "./schemas";

/**
 * Converts a wire predicted dock event to the TS-native Date-shaped DTO.
 *
 * @param convexPredictedDockEvent - Predicted event with epoch-ms time fields
 * @returns Predicted event with Date time fields
 */
const toPredictedDockEvent = (
  convexPredictedDockEvent: ConvexPredictedDockEvent
) => ({
  ...convexPredictedDockEvent,
  ScheduledDeparture: epochMsToDate(
    convexPredictedDockEvent.ScheduledDeparture
  ),
  EventPredictedTime: epochMsToDate(
    convexPredictedDockEvent.EventPredictedTime
  ),
  UpdatedAt: epochMsToDate(convexPredictedDockEvent.UpdatedAt),
  Actual: optionalEpochMsToDate(convexPredictedDockEvent.Actual),
});

/**
 * TS-native predicted dock event with Date time fields.
 */
type PredictedDockEvent = ReturnType<typeof toPredictedDockEvent>;

export type { PredictedDockEvent };
export { toPredictedDockEvent };
