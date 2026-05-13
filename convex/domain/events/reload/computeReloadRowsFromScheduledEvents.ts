/**
 * Builds scheduled and actual Convex rows from hydrated dock status events for
 * one sailing day reload.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import { buildBoundaryKey } from "shared/keys";
import { buildActualDockEventFromWrite } from "../actual";
import {
  buildPhysicalOnlyTripActualRows,
  dedupeActualRowsByEventKey,
  reconcileLiveLocations,
} from "./actuals";
import { compareDockEventsByTimeline } from "./schedule";
import { groupBy, IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS } from "./shared";
import type {
  ComputeReloadRowsFromScheduledEventsArgs,
  ComputeReloadRowsFromScheduledEventsResult,
  DockStatusEventRecord,
  TripContextForActualRow,
} from "./types";

/**
 * Adjusts back-to-back scheduled dock seams that share the same scheduled minute.
 *
 * WSF schedule rows occasionally place a vessel's arrival and the next leg's
 * departure at the same terminal at identical scheduled minutes. Leaving them
 * equal in the timeline makes the seam invisible to viewers and breaks
 * ordering invariants, so this helper nudges the duplicated dep time backward
 * by a small constant to keep arv-then-dep ordering stable.
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
      compareDockEventsByTimeline
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
 * Detects an arrival immediately followed by a same-terminal same-minute dep.
 *
 * @param current - Current boundary record
 * @param next - Next boundary record in sorted order, or undefined at the end
 * @returns True when the pair collides at the same scheduled instant
 */
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
 * Scheduled dock rows carry a NextTerminalAbbrev field so timeline UIs can
 * label the leg without reading the matching arrival row. Reload resolves
 * that hint here by looking up the sibling arrival on the same segment;
 * falling back to the current TerminalAbbrev keeps the field non-null when
 * an arrival is missing from the batch.
 *
 * @param event - Departure boundary row
 * @param eventByKey - Boundary record lookup keyed by event Key
 * @returns Terminal abbrev after the departure crossing
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
 * Scheduled rows expose IsLastArrivalOfSailingDay so timelines can highlight
 * the final dock of the day. Reload resolves that flag by scanning the
 * boundary records back-to-front for the latest arrival and reuses that key
 * when building scheduled rows. Returns null on schedule-only mismatches
 * where no arrival exists for the day.
 *
 * @param events - Boundary records for the sailing day, in timeline order
 * @returns Arrival row Key or null when no arrival exists
 */
const getLastArrivalKey = (events: DockStatusEventRecord[]) =>
  [...events].reverse().find((event) => event.EventType === "arv-dock")?.Key ??
  null;

/**
 * Builds scheduled and actual dock rows for one sailing day from hydrated events.
 *
 * Normalizes boundary seams, projects schedule rows, then assembles actuals
 * from three sources in priority order: history-merged events, physical-only
 * trips with TripKeys, and live-location reconciliation. The final actual set
 * is deduped by EventKey so downstream upserts see a unique row per physical
 * boundary even when multiple sources observed it.
 *
 * @param args - Hydrated events, sailing day, trip indexes, and locations
 * @returns Scheduled and actual rows ready for sailing-day reload persistence
 */
const computeReloadRowsFromScheduledEvents = ({
  sailingDay,
  events,
  updatedAt,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
  physicalOnlyTrips,
  vesselLocations,
}: ComputeReloadRowsFromScheduledEventsArgs): ComputeReloadRowsFromScheduledEventsResult => {
  // Normalize seams and sort so downstream builders see a stable timeline.
  const normalizedEvents = normalizeScheduledDockSeams(events).sort(
    compareDockEventsByTimeline
  );

  // Project scheduled rows directly from the normalized event stream.
  const scheduledRows = buildScheduledDockEvents(normalizedEvents, updatedAt);

  // Collect actuals from history-merged events and physical-only trip evidence.
  const baseActualRows = [
    ...buildActualDockEvents(normalizedEvents, updatedAt, tripBySegmentKey),
    ...buildPhysicalOnlyTripActualRows(physicalOnlyTrips, updatedAt),
  ];

  // Backfill from live locations for boundaries the prior sources missed.
  const liveLocationRows = reconcileLiveLocations({
    sailingDay,
    events: normalizedEvents,
    actualRows: baseActualRows,
    updatedAt,
    vesselLocations,
    tripBySegmentKey,
    activeTripsByVesselAbbrev,
  });

  // Dedupe by EventKey so the mutation sees one row per physical boundary.
  const actualRows = dedupeActualRowsByEventKey([
    ...baseActualRows,
    ...liveLocationRows,
  ]);

  return {
    scheduledRows,
    actualRows,
  };
};

/**
 * Projects hydrated boundary records into Convex scheduled dock rows.
 *
 * @param events - Hydrated boundary records sorted in timeline order
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @returns Validator-shaped scheduled dock rows
 */
const buildScheduledDockEvents = (
  events: DockStatusEventRecord[],
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
 * Projects hydrated boundary records with actual evidence into actual rows.
 *
 * @param events - Hydrated boundary records
 * @param updatedAt - UpdatedAt stamp for the produced rows
 * @param tripBySegmentKey - TripKey lookup keyed by segment key
 * @returns Validator-shaped actual dock rows for boundaries with actuals
 */
const buildActualDockEvents = (
  events: DockStatusEventRecord[],
  updatedAt: number,
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualDockEvent[] =>
  events
    .filter(
      (event) =>
        event.EventOccurred === true || event.EventActualTime !== undefined
    )
    .flatMap((event) => {
      const trip = tripBySegmentKey.get(event.SegmentKey);

      if (!trip?.TripKey) {
        return [];
      }

      return [
        buildActualDockEventFromWrite(
          {
            TripKey: trip.TripKey,
            VesselAbbrev: event.VesselAbbrev,
            SailingDay: event.SailingDay,
            ScheduledDeparture: event.ScheduledDeparture,
            TerminalAbbrev: event.TerminalAbbrev,
            EventType: event.EventType,
            EventOccurred: true,
            EventActualTime: event.EventActualTime,
          },
          updatedAt
        ),
      ];
    });

export { computeReloadRowsFromScheduledEvents };
