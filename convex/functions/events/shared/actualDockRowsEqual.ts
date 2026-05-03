/**
 * Equality helper for `eventsActual` upserts: skip replaces when visible fields match.
 */

import type { Doc } from "_generated/dataModel";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";

/**
 * Returns whether two rows describe the same observable dock event.
 *
 * Ignores Convex system fields; compares keys, terminals, times, and occurrence.
 *
 * @param left - Stored document from `eventsActual`
 * @param right - Payload being applied (includes `UpdatedAt`)
 * @returns `true` when no replace is needed for persistence purposes
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
