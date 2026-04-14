/**
 * Pure helpers for deriving normalized VesselTimeline scheduled boundary rows.
 */

import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../functions/vesselTimeline/schemas";
import { buildBoundaryKey } from "../../shared/keys";

/**
 * Builds normalized scheduled boundary rows from in-memory boundary event
 * records.
 *
 * @param events - Boundary event records for one vessel/day slice
 * @param updatedAt - Timestamp to stamp onto rows that are inserted or updated
 * @returns Scheduled boundary rows keyed by the stable event key
 */
export const buildScheduledBoundaryEvents = (
  events: ConvexVesselTimelineEventRecord[],
  updatedAt: number
): ConvexScheduledBoundaryEvent[] => {
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

const getNextTerminalAbbrev = (
  event: ConvexVesselTimelineEventRecord,
  eventByKey: Map<string, ConvexVesselTimelineEventRecord>
) => {
  const arrivalKey = buildBoundaryKey(event.SegmentKey, "arv-dock");

  return eventByKey.get(arrivalKey)?.TerminalAbbrev ?? event.TerminalAbbrev;
};

/**
 * Finds the latest arrival boundary in one sailing-day event slice.
 *
 * @param events - Ordered boundary events for one sailing day
 * @returns Boundary key for the last arrival, or `null`
 */
const getLastArrivalKey = (events: ConvexVesselTimelineEventRecord[]) =>
  [...events].reverse().find((event) => event.EventType === "arv-dock")?.Key ??
  null;
