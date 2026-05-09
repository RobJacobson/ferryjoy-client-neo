/**
 * Builds scheduled and actual Convex rows from hydrated reload boundary events.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import { buildActualDockEventFromWrite } from "../actual";
import {
  getLastArrivalKey,
  getNextTerminalAbbrev,
  normalizeScheduledDockSeams,
  sortDockBoundaryEventRecords,
} from "./boundarySeams";
import { dedupeActualRowsByEventKey } from "./dedupeActualRows";
import { buildLiveLocationActualRows } from "./liveLocationReconciliation";
import type {
  ActiveTripForPhysicalActualReconcile,
  BuildReloadDockSliceFromHydratedArgs,
  BuildReloadDockSliceResult,
  DockBoundaryEventRecord,
  TripContextForActualRow,
} from "./types";

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

const buildActualDockEvents = (
  events: DockBoundaryEventRecord[],
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

const buildPhysicalOnlyActualRowsFromTrips = (
  trips: ActiveTripForPhysicalActualReconcile[],
  updatedAt: number
): ConvexActualDockEvent[] =>
  trips
    .filter(
      (trip) => trip.TripKey !== undefined && trip.ScheduleKey === undefined
    )
    .flatMap((trip) => {
      const rows: ConvexActualDockEvent[] = [];

      if (trip.TripKey !== undefined && trip.LeftDockActual !== undefined) {
        rows.push(
          buildActualDockEventFromWrite(
            {
              TripKey: trip.TripKey,
              VesselAbbrev: trip.VesselAbbrev,
              SailingDay: trip.SailingDay,
              ScheduledDeparture: trip.ScheduledDeparture,
              TerminalAbbrev: trip.DepartingTerminalAbbrev,
              EventType: "dep-dock",
              EventOccurred: true,
              EventActualTime: trip.LeftDockActual,
            },
            updatedAt
          )
        );
      }

      if (
        trip.TripKey !== undefined &&
        trip.TripEnd !== undefined &&
        trip.ArrivingTerminalAbbrev !== undefined
      ) {
        rows.push(
          buildActualDockEventFromWrite(
            {
              TripKey: trip.TripKey,
              VesselAbbrev: trip.VesselAbbrev,
              SailingDay: trip.SailingDay,
              ScheduledDeparture: trip.ScheduledDeparture,
              TerminalAbbrev: trip.ArrivingTerminalAbbrev,
              EventType: "arv-dock",
              EventOccurred: true,
              EventActualTime: trip.TripEnd,
            },
            updatedAt
          )
        );
      }

      return rows;
    });

/**
 * Builds scheduled and actual dock rows from hydrated boundary events.
 *
 * @param args - Hydrated events, sailing day, trip indexes, and locations
 * @returns Scheduled and actual rows plus operator-facing counts
 */
const buildReloadDockSliceFromHydratedEvents = ({
  sailingDay,
  events,
  updatedAt,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
  physicalOnlyTrips,
  vesselLocations,
}: BuildReloadDockSliceFromHydratedArgs): BuildReloadDockSliceResult => {
  const normalizedEvents = normalizeScheduledDockSeams(events).sort(
    sortDockBoundaryEventRecords
  );
  const scheduledRows = buildScheduledDockEvents(normalizedEvents, updatedAt);
  const baseActualRows = dedupeActualRowsByEventKey([
    ...buildActualDockEvents(normalizedEvents, updatedAt, tripBySegmentKey),
    ...buildPhysicalOnlyActualRowsFromTrips(physicalOnlyTrips, updatedAt),
  ]);
  const liveLocationRows = buildLiveLocationActualRows({
    sailingDay,
    events: normalizedEvents,
    actualRows: baseActualRows,
    updatedAt,
    vesselLocations,
    tripBySegmentKey,
    activeTripsByVesselAbbrev,
  });
  const actualRows = dedupeActualRowsByEventKey([
    ...baseActualRows,
    ...liveLocationRows,
  ]);

  return {
    scheduledRows,
    scheduledCount: normalizedEvents.length,
    actualRows,
    actualCount: actualRows.length,
  };
};

export { buildReloadDockSliceFromHydratedEvents };
