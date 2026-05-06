/**
 * Normalizes and orders dock-boundary records for event reloads.
 *
 * The helpers preserve deterministic vessel/day ordering and repair schedule
 * seams that would otherwise collapse dock intervals to zero duration.
 */

import { buildVesselSailingDayScopeKey } from "../../../shared/keys";
import type { DockEventType } from "../common/types";
import type { DockBoundaryEventRecord } from "./types";

export const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;

/**
 * Comparator for stable vessel-day ordering of in-memory boundary records.
 *
 * Orders by scheduled departure, then event type (arrival before departure at
 * equal times), then terminal label so ties within a minute remain deterministic.
 *
 * @param left - First boundary record in a comparison
 * @param right - Second boundary record in a comparison
 * @returns Negative when left sorts before right, positive when after, zero when equal
 */
export const sortDockBoundaryEventRecords = (
  left: DockBoundaryEventRecord,
  right: DockBoundaryEventRecord
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Nudges scheduled seam times when arrival and departure share an identical dock instant.
 *
 * WSF data sometimes lists arrival and departure at the same scheduled minute at
 * one dock, which would imply zero dwell. Subtracting a fixed offset from the
 * arrival EventScheduledTime preserves ordering while giving downstream interval
 * builders a non-zero at-dock span per vessel day.
 *
 * @param events - Boundary events grouped by vessel and day (caller typically pre-sorted)
 * @returns New array entries with adjusted EventScheduledTime keys where seams were repaired
 */
export const normalizeScheduledDockSeams = (
  events: DockBoundaryEventRecord[]
): DockBoundaryEventRecord[] => {
  const adjustedScheduledTimesByKey = new Map<string, number>();
  const eventsByVesselDay = new Map<string, DockBoundaryEventRecord[]>();

  for (const event of events) {
    const vesselDayKey = buildVesselSailingDayScopeKey(
      event.VesselAbbrev,
      event.SailingDay
    );
    const scopedEvents = eventsByVesselDay.get(vesselDayKey);

    if (scopedEvents) {
      scopedEvents.push(event);
      continue;
    }

    eventsByVesselDay.set(vesselDayKey, [event]);
  }

  for (const scopedEvents of eventsByVesselDay.values()) {
    const sortedScopedEvents = [...scopedEvents].sort(
      sortDockBoundaryEventRecords
    );

    for (let index = 0; index < sortedScopedEvents.length; index++) {
      const event = sortedScopedEvents[index];
      if (
        event?.EventScheduledTime &&
        isIdenticalScheduledDockSeam(event, sortedScopedEvents[index + 1])
      ) {
        adjustedScheduledTimesByKey.set(
          event.Key,
          event.EventScheduledTime - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
        );
      }
    }
  }

  return events.map((event) => {
    const adjustedScheduledTime = adjustedScheduledTimesByKey.get(event.Key);

    return adjustedScheduledTime !== undefined
      ? {
          ...event,
          EventScheduledTime: adjustedScheduledTime,
        }
      : event;
  });
};

/**
 * True when an arrival at the dock is immediately followed by a departure at the
 * same terminal with identical scheduled event times.
 *
 * Identifies the zero-length seam pattern normalizeScheduledDockSeams corrects
 * so interval builders see a believable dwell instead of a collapsed instant.
 *
 * @param current - Current arrival row in a sorted per-day list
 * @param next - Following boundary row, when present
 * @returns True when the pair forms an identical-time dock seam
 */
const isIdenticalScheduledDockSeam = (
  current: DockBoundaryEventRecord,
  next: DockBoundaryEventRecord | undefined
) =>
  next !== undefined &&
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev &&
  next.EventScheduledTime !== undefined &&
  current.EventScheduledTime === next.EventScheduledTime;

/**
 * Relative ordering rank for dep-dock versus arv-dock when timestamps tie.
 *
 * Arrivals sort before departures at the same scheduled instant so at-dock leg
 * boundaries stay visually consistent with vessel motion.
 *
 * @param eventType - Dock boundary discriminator
 * @returns Numeric rank; lower sorts earlier when departure times match
 */
const getEventTypeOrder = (eventType: DockEventType) =>
  eventType === "arv-dock" ? 0 : 1;
