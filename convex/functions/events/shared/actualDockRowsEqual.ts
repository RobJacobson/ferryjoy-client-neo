/**
 * Equality helper for eventsActual upserts: skip replaces when visible fields match.
 */

import type { Doc } from "_generated/dataModel";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";

/**
 * Compares stored documents with incoming payloads for semantic equality.
 *
 * Convex adds system fields that must not force replaces; this compares only the
 * payload columns clients observe. EventOccurred is treated as equivalent to having
 * EventActualTime so sparse pings that toggle only the literal flag still compare equal.
 *
 * @param left - Stored eventsActual document including Convex metadata
 * @param right - Candidate row being applied (includes fresh UpdatedAt)
 * @returns True when upsertActualDockRows should skip replace for this EventKey
 */
const actualDockRowsEqual = (
  left: Doc<"eventsActual">,
  right: ConvexActualDockEvent
): boolean =>
  left.EventKey === right.EventKey &&
  left.TripKey === right.TripKey &&
  left.EventType === right.EventType &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  (left.EventOccurred ?? left.EventActualTime !== undefined) ===
    (right.EventOccurred ?? right.EventActualTime !== undefined) &&
  left.EventActualTime === right.EventActualTime;

export { actualDockRowsEqual };
