/**
 * Stable boundary-record comparator shared by reload row builders and
 * scheduled-event hydration.
 */

import type { DockEventType, DockStatusEventRecord } from "../types";

/**
 * Compares two boundary records for timeline ordering when sorting an array.
 *
 * The reload pipeline assumes boundary records arrive in timeline order so
 * seam detection and last-arrival lookup work without further sorting. This
 * comparator orders by scheduled departure first, with dep-before-arv and
 * terminal-name tiebreakers so two boundaries at the same minute always have
 * a deterministic neighbor relationship.
 *
 * @param left - First record
 * @param right - Second record
 * @returns Comparator value suitable for Array.sort
 */
const compareDockEventsByTimeline = (
  left: DockStatusEventRecord,
  right: DockStatusEventRecord
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Maps dep-dock and arv-dock to a stable sort index.
 *
 * @param eventType - Dock boundary discriminator
 * @returns 0 for departures, 1 for arrivals
 */
const getEventTypeOrder = (eventType: DockEventType) =>
  eventType === "dep-dock" ? 0 : 1;

export { compareDockEventsByTimeline };
