/**
 * Builds actual dock-event rows for a sailing-day reload.
 *
 * Composes schedule-derived boundary records, trip indexes, physical-only trips,
 * and live locations into the actual row slice that Convex mutations upsert.
 */

import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import {
  normalizeScheduledDockSeams,
  sortDockBoundaryEventRecords,
} from "../scheduled/normalizeScheduledDockEventRecords";
import type { DockBoundaryEventRecord } from "../scheduled/types";
import type {
  ActiveTripForPhysicalActualReconcile,
  TripContextForActualRow,
} from "./bindActualRowsToTrips";
import {
  buildActualDockEventFromWrite,
  buildActualDockEvents,
} from "./buildActualDockEvents";
import { mergeActualDockWritesIntoRows } from "./mergeActualDockWritesIntoRows";
import { reconcileActualDockWritesFromLocations } from "./reconcileDockTransitionsFromLocations";

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
 * Builds actual Convex rows for one sailing-day reload pass.
 *
 * Normalizes seam artifacts, builds base actual rows from schedule-backed
 * evidence plus physical-only trips, then layers live-location reconciliation
 * and merges patches back into the base set. Neutral boundary records provide
 * schedule context without depending on the persisted scheduled table shape.
 *
 * @param args.sailingDay - Calendar sailing day string for filtering locations
 * @param args.events - Hydrated boundary records for the day (seed plus history)
 * @param args.updatedAt - Shared write timestamp for all derived rows
 * @param args.tripBySegmentKey - Segment to TripKey context from trip indexes
 * @param args.activeTripsByVesselAbbrev - Active trips for scheduleless patches
 * @param args.physicalOnlyTrips - Trips without ScheduleKey for bare-metal actuals
 * @param args.vesselLocations - Latest locations used for live reconciliation
 * @returns Actual rows and actual row count for persistence feedback
 */
const buildActualDockRowsForSailingDayReload = ({
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
  const baseActualRows = dedupeActualRowsByEventKey([
    ...buildActualDockEvents(normalizedEvents, updatedAt, tripBySegmentKey),
    ...buildPhysicalOnlyActualRowsFromTrips(physicalOnlyTrips, updatedAt),
  ]);
  const liveLocationActualPatches = reconcileActualDockWritesFromLocations({
    sailingDay,
    scheduledEvents: normalizedEvents,
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
    actualRows,
    actualCount: actualRows.length,
  };
};

/**
 * Synthesizes actual rows from trips that have TripKey but no ScheduleKey.
 *
 * Some legs exist only in physical trip tables (no schedule row). Reload still
 * needs dep-dock and arv-dock actuals when LeftDockActual and TripEnd are present
 * so the day slice stays consistent with vessel-track state before live patches.
 *
 * @param trips - Active or completed trips filtered to the reload scope
 * @param updatedAt - Stamp applied to each synthesized row
 * @returns Flat list of zero, one, or two rows per qualifying trip
 */
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

/**
 * Deduplicates rows that share EventKey, keeping the last occurrence.
 *
 * Multiple builders can emit the same physical boundary during reload; Map
 * semantics match upsert behavior so the final row matches what persistence would
 * store after sequential replaces.
 *
 * @param rows - Rows that may repeat EventKey
 * @returns Deduplicated rows in insertion order of first key appearance after collapse
 */
const dedupeActualRowsByEventKey = <T extends { EventKey: string }>(
  rows: T[]
) => [...new Map(rows.map((row) => [row.EventKey, row])).values()];

export { buildActualDockRowsForSailingDayReload };
