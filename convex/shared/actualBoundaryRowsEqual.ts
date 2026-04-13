/**
 * Equality helpers for normalized `eventsActual` persistence (skip no-op writes).
 */

import type { Doc } from "_generated/dataModel";
import type { ConvexActualBoundaryEvent } from "../functions/eventsActual/schemas";

/**
 * Returns whether a stored row matches the candidate for all user-visible
 * fields (excluding system fields and `UpdatedAt`).
 *
 * @param left - Row currently stored in `eventsActual`
 * @param right - Candidate insert/replace payload including `UpdatedAt`
 * @returns True when no replace is needed
 */
export const actualBoundaryRowsEqual = (
  left: Doc<"eventsActual">,
  right: ConvexActualBoundaryEvent
): boolean =>
  left.Key === right.Key &&
  left.EventKey === right.EventKey &&
  left.TripKey === right.TripKey &&
  left.ScheduleKey === right.ScheduleKey &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  (left.EventOccurred ?? left.EventActualTime !== undefined) ===
    (right.EventOccurred ?? right.EventActualTime !== undefined) &&
  left.EventActualTime === right.EventActualTime;
