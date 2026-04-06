/**
 * Equality for `eventsActual` rows vs candidate write payloads.
 */

import type { Doc } from "_generated/dataModel";
import type { ConvexActualBoundaryEvent } from "./schemas";

/**
 * Returns whether a stored row matches the candidate for all user-visible
 * fields (excluding system fields).
 *
 * @param left - Row currently stored in `eventsActual`
 * @param right - Candidate insert/replace payload including `UpdatedAt`
 * @returns True when no replace is needed
 */
export const actualRowsEqual = (
  left: Doc<"eventsActual">,
  right: ConvexActualBoundaryEvent
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  (left.EventOccurred ?? (left.EventActualTime !== undefined)) ===
    (right.EventOccurred ?? (right.EventActualTime !== undefined)) &&
  left.EventActualTime === right.EventActualTime;
