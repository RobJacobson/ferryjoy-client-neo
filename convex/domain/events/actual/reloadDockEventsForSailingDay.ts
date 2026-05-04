/**
 * Builds scheduled and actual dock-event rows for a sailing-day reload.
 *
 * The function composes schedule-derived boundary records, existing trip
 * indexes, physical-only trips, and live locations into the row slices that the
 * Convex mutation layer writes to event tables.
 */

import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import { buildScheduledDockEvents } from "../scheduled/buildScheduledDockEvents";
import {
  normalizeScheduledDockSeams,
  sortDockBoundaryEventRecords,
} from "../scheduled/normalizeScheduledDockEventRecords";
import type { DockBoundaryEventRecord } from "../types";
import type {
  ActiveTripForPhysicalActualReconcile,
  TripContextForActualRow,
} from "./bindActualRowsToTrips";
import {
  buildActualDockEventFromWrite,
  buildActualDockEvents,
} from "./buildActualDockEvents";
import { mergeActualDockWritesIntoRows } from "./mergeActualDockWritesIntoRows";
import { reconcileActualDockWritesFromLocations } from "./reconcileActualDockEventsFromLocations";

type BuildDockEventRowsForSailingDayReloadArgs = {
  sailingDay: string;
  events: DockBoundaryEventRecord[];
  updatedAt: number;
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
  physicalOnlyTrips: ActiveTripForPhysicalActualReconcile[];
  vesselLocations: ConvexVesselLocation[];
};

/**
 * Builds scheduled and actual event-table rows for one sailing-day reload.
 *
 * @param args - Hydrated boundary records and reconciliation inputs
 * @returns Scheduled and actual rows plus row counts for operator feedback
 */
export const buildDockEventRowsForSailingDayReload = ({
  sailingDay,
  events,
  updatedAt,
  tripBySegmentKey,
  activeTripsByVesselAbbrev = new Map(),
  physicalOnlyTrips = [],
  vesselLocations,
}: BuildDockEventRowsForSailingDayReloadArgs) => {
  const normalizedEvents = normalizeScheduledDockSeams(events).sort(
    sortDockBoundaryEventRecords
  );
  const scheduledRows = buildScheduledDockEvents(normalizedEvents, updatedAt);
  const baseActualRows = dedupeActualRowsByEventKey([
    ...buildActualDockEvents(normalizedEvents, updatedAt, tripBySegmentKey),
    ...buildPhysicalOnlyActualRowsFromTrips(physicalOnlyTrips, updatedAt),
  ]);
  const liveLocationActualPatches = reconcileActualDockWritesFromLocations({
    sailingDay,
    scheduledEvents: scheduledRows,
    actualEvents: baseActualRows,
    vesselLocations,
    tripBySegmentKey,
    activeTripsByVesselAbbrev,
  });
  const actualRows = mergeActualDockWritesIntoRows(
    baseActualRows,
    liveLocationActualPatches,
    updatedAt
  );

  return {
    scheduledRows,
    actualRows,
    scheduledCount: normalizedEvents.length,
    actualCount: actualRows.length,
  };
};

const buildPhysicalOnlyActualRowsFromTrips = (
  trips: ActiveTripForPhysicalActualReconcile[],
  updatedAt: number
) =>
  trips
    .filter(
      (trip) => trip.TripKey !== undefined && trip.ScheduleKey === undefined
    )
    .flatMap((trip) => {
      const departureActualTime = trip.LeftDockActual;
      const rows = [];

      if (departureActualTime !== undefined) {
        rows.push(
          buildActualDockEventFromWrite(
            {
              TripKey: trip.TripKey as string,
              ScheduleKey: undefined,
              VesselAbbrev: trip.VesselAbbrev,
              ...(trip.SailingDay !== undefined
                ? { SailingDay: trip.SailingDay }
                : {}),
              ...(trip.ScheduledDeparture !== undefined
                ? { ScheduledDeparture: trip.ScheduledDeparture }
                : {}),
              TerminalAbbrev: trip.DepartingTerminalAbbrev,
              EventType: "dep-dock" as const,
              EventOccurred: true,
              EventActualTime: departureActualTime,
            },
            updatedAt
          )
        );
      }

      if (
        trip.TripEnd !== undefined &&
        trip.ArrivingTerminalAbbrev !== undefined
      ) {
        rows.push(
          buildActualDockEventFromWrite(
            {
              TripKey: trip.TripKey as string,
              ScheduleKey: undefined,
              VesselAbbrev: trip.VesselAbbrev,
              ...(trip.SailingDay !== undefined
                ? { SailingDay: trip.SailingDay }
                : {}),
              ...(trip.ScheduledDeparture !== undefined
                ? { ScheduledDeparture: trip.ScheduledDeparture }
                : {}),
              TerminalAbbrev: trip.ArrivingTerminalAbbrev,
              EventType: "arv-dock" as const,
              EventOccurred: true,
              EventActualTime: trip.TripEnd,
            },
            updatedAt
          )
        );
      }

      return rows;
    });

const dedupeActualRowsByEventKey = <T extends { EventKey: string }>(
  rows: T[]
) => [...new Map(rows.map((row) => [row.EventKey, row])).values()];
