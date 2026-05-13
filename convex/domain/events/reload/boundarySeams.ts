/**
 * Scheduled dock seam normalization, boundary ordering, and history-vs-existing
 * actual time merge when assembling sailing-day reload rows.
 */

import { buildBoundaryKey } from "shared/keys";
import { groupBy } from "./collections";
import {
  ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS,
  DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS,
  IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS,
} from "./constants";
import type {
  DockEventType,
  DockStatusEventRecord,
  HistoryActualSource,
} from "./types";

/**
 * Adjusts back-to-back scheduled dock seams that share the same scheduled minute.
 *
 * @param events - Boundary records for one reload batch
 * @returns Copy with dep times nudged where identical seams were detected
 */
const normalizeScheduledDockSeams = (
  events: DockStatusEventRecord[]
): DockStatusEventRecord[] => {
  const adjustedScheduledTimesByKey = new Map<string, number>();
  const eventsByVesselDay = groupBy(
    events,
    (event) => `${event.VesselAbbrev}:${event.SailingDay}`
  );

  for (const scopedEvents of eventsByVesselDay.values()) {
    const sortedScopedEvents = [...scopedEvents].sort(
      sortDockStatusEventRecords
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
      ? { ...event, EventScheduledTime: adjustedScheduledTime }
      : event;
  });
};

/**
 * Chooses the actual timestamp to keep when history and an existing row disagree.
 *
 * @param existingActualTime - Time already on the boundary record
 * @param historyActualTime - Time from WSF history hydration
 * @param source - Whether the history column was departure-actual or arrival-proxy
 * @returns Merged actual ms or undefined when both inputs are undefined
 */
const mergeActualTime = (
  existingActualTime?: number,
  historyActualTime?: number,
  source?: HistoryActualSource
) => {
  if (existingActualTime === undefined) {
    return historyActualTime;
  }

  if (historyActualTime === undefined) {
    return existingActualTime;
  }

  const replacementThreshold =
    source === "arrival-proxy"
      ? ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS
      : DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS;

  return Math.abs(existingActualTime - historyActualTime) >=
    replacementThreshold
    ? historyActualTime
    : existingActualTime;
};

/**
 * Sorts boundary records for stable seam and terminal tie-break ordering.
 *
 * @param left - First record
 * @param right - Second record
 * @returns Comparator value for Array.sort
 */
const sortDockStatusEventRecords = (
  left: DockStatusEventRecord,
  right: DockStatusEventRecord
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

const getEventTypeOrder = (eventType: DockEventType) =>
  eventType === "dep-dock" ? 0 : 1;

const isIdenticalScheduledDockSeam = (
  current: DockStatusEventRecord,
  next: DockStatusEventRecord | undefined
) =>
  next !== undefined &&
  current.EventType === "arv-dock" &&
  next.EventType === "dep-dock" &&
  current.TerminalAbbrev === next.TerminalAbbrev &&
  next.EventScheduledTime !== undefined &&
  current.EventScheduledTime === next.EventScheduledTime;

/**
 * Resolves NextTerminalAbbrev for a departure row from its paired arrival row.
 *
 * @param event - Departure boundary row
 * @param eventByKey - Lookup for sibling arrivals on the same segment
 * @returns Terminal abbrev after departure crossing
 */
const getNextTerminalAbbrev = (
  event: DockStatusEventRecord,
  eventByKey: Map<string, DockStatusEventRecord>
) =>
  eventByKey.get(buildBoundaryKey(event.SegmentKey, "arv-dock"))
    ?.TerminalAbbrev ?? event.TerminalAbbrev;

/**
 * Finds the chronologically last arrival boundary key in a same-day list.
 *
 * @param events - Ordered or unordered boundary records for the sailing day
 * @returns Arrival row Key or null when no arrival exists
 */
const getLastArrivalKey = (events: DockStatusEventRecord[]) =>
  [...events].reverse().find((event) => event.EventType === "arv-dock")?.Key ??
  null;

export {
  getLastArrivalKey,
  getNextTerminalAbbrev,
  mergeActualTime,
  normalizeScheduledDockSeams,
  sortDockStatusEventRecords,
};
