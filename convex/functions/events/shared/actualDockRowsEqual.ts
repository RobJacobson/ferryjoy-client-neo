/**
 * Equality helpers for normalized `eventsActual` persistence (skip no-op writes).
 */

import type { Doc } from "_generated/dataModel";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";

/**
 * Returns whether a stored row matches the candidate for all user-visible
 * fields (excluding system fields and `UpdatedAt`).
 *
 * @param left - Row currently stored in `eventsActual`
 * @param right - Candidate insert/replace payload including `UpdatedAt`
 * @returns True when no replace is needed
 */
export const actualDockRowsEqual = (
  left: Doc<"eventsActual">,
  right: ConvexActualDockEvent
): boolean =>
  left.EventKey === right.EventKey &&
  left.TripKey === right.TripKey &&
  left.ScheduleKey === right.ScheduleKey &&
  left.EventType === right.EventType &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  (left.EventOccurred ?? left.EventActualTime !== undefined) ===
    (right.EventOccurred ?? right.EventActualTime !== undefined) &&
  left.EventActualTime === right.EventActualTime;
