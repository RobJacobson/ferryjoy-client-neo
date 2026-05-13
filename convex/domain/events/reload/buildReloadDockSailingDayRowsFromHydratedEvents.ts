/**
 * Builds scheduled and actual Convex rows from hydrated dock status events for
 * one sailing day reload.
 */

import type { DockEventType } from "functions/events/common/schemas";
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

/**
 * Builds actual dock rows for all physical-only trips that have TripKeys.
 *
 * @param trips - Merged active and completed trips for the sailing day
 * @param updatedAt - UpdatedAt stamp for persisted rows
 * @returns Flat list of dep and arv actual rows across trips
 */
const buildPhysicalOnlyActualRowsFromTrips = (
  trips: ActiveTripForPhysicalActualReconcile[],
  updatedAt: number
): ConvexActualDockEvent[] =>
  trips
    .filter(isPhysicalOnlyTripWithTripKey)
    .flatMap((trip) => buildPhysicalOnlyActualRowsForTrip(trip, updatedAt));

/**
 * Builds zero to two actual rows for one physical-only trip when dep or arv
 * evidence exists.
 *
 * @param trip - Physical-only trip with TripKey
 * @param updatedAt - UpdatedAt stamp for Convex rows
 * @returns Dep row, arv row, or both, in that order when present
 */
const buildPhysicalOnlyActualRowsForTrip = (
  trip: ActiveTripForPhysicalActualReconcile & { TripKey: string },
  updatedAt: number
): ConvexActualDockEvent[] =>
  [
    trip.LeftDockActual === undefined
      ? null
      : buildPhysicalOnlyTripActualRow(
          trip,
          trip.DepartingTerminalAbbrev,
          "dep-dock",
          trip.LeftDockActual,
          updatedAt
        ),
    trip.TripEnd === undefined || trip.ArrivingTerminalAbbrev === undefined
      ? null
      : buildPhysicalOnlyTripActualRow(
          trip,
          trip.ArrivingTerminalAbbrev,
          "arv-dock",
          trip.TripEnd,
          updatedAt
        ),
  ].filter((row): row is ConvexActualDockEvent => row !== null);

/**
 * Builds one actual dock row for a physical-only trip boundary.
 *
 * @param trip - Physical-only trip with TripKey
 * @param terminalAbbrev - Terminal for this dep or arv row
 * @param eventType - dep-dock or arv-dock
 * @param eventActualTime - Observed time in epoch ms
 * @param updatedAt - UpdatedAt stamp for the Convex row
 * @returns Normalized eventsActual row
 */
const buildPhysicalOnlyTripActualRow = (
  trip: ActiveTripForPhysicalActualReconcile & { TripKey: string },
  terminalAbbrev: string,
  eventType: DockEventType,
  eventActualTime: number,
  updatedAt: number
): ConvexActualDockEvent =>
  buildActualDockEventFromWrite(
    {
      TripKey: trip.TripKey,
      VesselAbbrev: trip.VesselAbbrev,
      SailingDay: trip.SailingDay,
      ScheduledDeparture: trip.ScheduledDeparture,
      TerminalAbbrev: terminalAbbrev,
      EventType: eventType,
      EventOccurred: true,
      EventActualTime: eventActualTime,
    },
    updatedAt
  );

/**
 * True when the trip is physical-only and carries a TripKey for actual rows.
 *
 * @param trip - Active or completed trip row from reload indexes
 * @returns Type guard narrowing TripKey to string when true
 */
const isPhysicalOnlyTripWithTripKey = (
  trip: ActiveTripForPhysicalActualReconcile
): trip is ActiveTripForPhysicalActualReconcile & { TripKey: string } =>
  trip.TripKey !== undefined && trip.ScheduleKey === undefined;

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
