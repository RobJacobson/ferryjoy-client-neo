/**
 * Builds scheduled and actual Convex rows from hydrated dock status events for
 * one sailing day reload.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import { buildActualDockEventFromWrite } from "../actual";
import {
  getLastArrivalKey,
  getNextTerminalAbbrev,
  normalizeScheduledDockSeams,
  sortDockStatusEventRecords,
} from "./boundarySeams";
import { dedupeActualRowsByEventKey } from "./dedupeActualRows";
import { buildLiveLocationActualRows } from "./liveLocationReconciliation";
import type {
  ActiveTripForPhysicalActualReconcile,
  BuildReloadDockSailingDayRowsFromHydratedArgs,
  BuildReloadDockSailingDayRowsResult,
  DockStatusEventRecord,
  TripContextForActualRow,
} from "./types";

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
 * Builds scheduled and actual dock rows for one sailing day from hydrated events.
 *
 * @param args - Hydrated events, sailing day, trip indexes, and locations
 * @returns Scheduled and actual rows plus operator-facing counts
 */
const buildReloadDockSailingDayRowsFromHydratedEvents = ({
  sailingDay,
  events,
  updatedAt,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
  physicalOnlyTrips,
  vesselLocations,
}: BuildReloadDockSailingDayRowsFromHydratedArgs): BuildReloadDockSailingDayRowsResult => {
  const normalizedEvents = normalizeScheduledDockSeams(events).sort(
    sortDockStatusEventRecords
  );
  const scheduledRows = buildScheduledDockEvents(normalizedEvents, updatedAt);
  const baseActualRows = [
    ...buildActualDockEvents(normalizedEvents, updatedAt, tripBySegmentKey),
    ...buildPhysicalOnlyActualRowsFromTrips(physicalOnlyTrips, updatedAt),
  ];
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

export { buildReloadDockSailingDayRowsFromHydratedEvents };
