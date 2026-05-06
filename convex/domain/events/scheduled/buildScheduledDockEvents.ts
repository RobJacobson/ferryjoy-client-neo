/**
 * Builds persisted scheduled dock-event rows from boundary event records.
 *
 * These helpers keep schedule-row derivation in the scheduled-event domain
 * while reload orchestration decides when the rows should be persisted.
 */

import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import { buildBoundaryKey } from "../../../shared/keys";
import type { DockBoundaryEventRecord } from "./types";

/**
 * Maps neutral boundary records into Convex scheduled dock rows for one slice.
 *
 * NextTerminalAbbrev stitches departures to their paired arrival terminal using
 * the same-day map so continuity reads do not need a second query. Last arrival
 * of day is flagged for UI hints using the maximum arrival Key in the slice.
 *
 * @param events - Boundary event records for one vessel/day slice
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @returns Scheduled boundary rows aligned one-to-one with input events
 */
const buildScheduledDockEvents = (
  events: DockBoundaryEventRecord[],
  updatedAt: number
): ConvexScheduledDockEvent[] => {
  const eventByKey = new Map(events.map((event) => [event.Key, event]));
  const lastArrivalKey = getLastArrivalKey(events);

  return events.map((event) => ({
    Key: event.Key,
    VesselAbbrev: event.VesselAbbrev,
    SailingDay: event.SailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: event.ScheduledDeparture,
    TerminalAbbrev: event.TerminalAbbrev,
    NextTerminalAbbrev:
      event.EventType === "arv-dock"
        ? event.TerminalAbbrev
        : getNextTerminalAbbrev(event, eventByKey),
    EventType: event.EventType,
    EventScheduledTime: event.EventScheduledTime,
    IsLastArrivalOfSailingDay:
      event.EventType === "arv-dock" && event.Key === lastArrivalKey,
  }));
};

/**
 * Looks up the paired arrival rows terminal for a departure on the same segment.
 *
 * Departures need the downstream terminal for NextTerminalAbbrev; that value
 * lives on the arv-dock row that shares SegmentKey. When the pair is missing,
 * falls back to the departure rows own terminal to avoid undefined continuity.
 *
 * @param event - Departure boundary whose next terminal is needed
 * @param eventByKey - Map of every boundary Key in the sailing-day slice
 * @returns Arrival terminal abbrev for the segment, or the events terminal abbrev
 */
const getNextTerminalAbbrev = (
  event: DockBoundaryEventRecord,
  eventByKey: Map<string, DockBoundaryEventRecord>
) => {
  const arrivalKey = buildBoundaryKey(event.SegmentKey, "arv-dock");

  return eventByKey.get(arrivalKey)?.TerminalAbbrev ?? event.TerminalAbbrev;
};

/**
 * Finds the chronologically last arrival boundary in the slice.
 *
 * Used only to mark IsLastArrivalOfSailingDay for presentation; ordering follows
 * caller-provided event order after normalizeScheduledDockSeams and sort.
 *
 * @param events - Boundary events for one sailing day (any order; reversed internally)
 * @returns Key of the last arv-dock event when one exists, otherwise null
 */
const getLastArrivalKey = (events: DockBoundaryEventRecord[]) =>
  [...events].reverse().find((event) => event.EventType === "arv-dock")?.Key ??
  null;

export { buildScheduledDockEvents };
