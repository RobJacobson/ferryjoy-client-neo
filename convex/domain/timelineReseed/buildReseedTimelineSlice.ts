/**
 * Public reseed row-slice assembly entrypoint.
 */

import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../functions/vesselTimeline/schemas";
import {
  type ActiveTripForPhysicalActualReconcile,
  buildActualBoundaryEventFromPatch,
  buildActualBoundaryEvents,
  buildScheduledBoundaryEvents,
  type TripContextForActualRow,
} from "../timelineRows";
import { mergeActualBoundaryPatchesIntoRows } from "./mergeActualBoundaryPatchesIntoRows";
import {
  normalizeScheduledDockSeams,
  sortVesselTripEvents,
} from "./normalizeEventRecords";
import { buildActualBoundaryPatchesForSailingDay } from "./reconcileLiveLocations";

type BuildReseedTimelineSliceArgs = {
  sailingDay: string;
  events: ConvexVesselTimelineEventRecord[];
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
 * Builds the scheduled/actual row slice for one reseeded sailing day from
 * already-hydrated event records plus live reconciliation inputs.
 */
export const buildReseedTimelineSlice = ({
  sailingDay,
  events,
  updatedAt,
  tripBySegmentKey,
  activeTripsByVesselAbbrev = new Map(),
  physicalOnlyTrips = [],
  vesselLocations,
}: BuildReseedTimelineSliceArgs) => {
  const normalizedEvents =
    normalizeScheduledDockSeams(events).sort(sortVesselTripEvents);
  const scheduledRows = buildScheduledBoundaryEvents(
    normalizedEvents,
    updatedAt
  );
  const baseActualRows = dedupeActualRowsByEventKey([
    ...buildActualBoundaryEvents(normalizedEvents, updatedAt, tripBySegmentKey),
    ...buildPhysicalOnlyActualRowsFromTrips(physicalOnlyTrips, updatedAt),
  ]);
  const liveLocationActualPatches = buildActualBoundaryPatchesForSailingDay({
    sailingDay,
    scheduledEvents: scheduledRows,
    actualEvents: baseActualRows,
    vesselLocations,
    tripBySegmentKey,
    activeTripsByVesselAbbrev,
  });
  const actualRows = mergeActualBoundaryPatchesIntoRows(
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
      const departureActualTime = trip.DepartOriginActual;
      const rows = [];

      if (departureActualTime !== undefined) {
        rows.push(
          buildActualBoundaryEventFromPatch(
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
        trip.ArriveDestDockActual !== undefined &&
        trip.ArrivingTerminalAbbrev !== undefined
      ) {
        rows.push(
          buildActualBoundaryEventFromPatch(
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
              EventActualTime: trip.ArriveDestDockActual,
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
