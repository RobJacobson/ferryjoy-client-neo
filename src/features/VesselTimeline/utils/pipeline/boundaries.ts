/**
 * Pipeline stage 1: derive boundary points for each normalized vessel-day trip.
 *
 * This stage converts normalized trip records into boundary-oriented data so the
 * later stages can build dock and sea rows without repeatedly reimplementing
 * the same fallback logic.
 */

import type { VesselTimelineTrip } from "@/data/contexts";
import type {
  VesselTimelineBoundary,
  VesselTimelineTimePoint,
} from "../../types";

/**
 * Boundary-oriented timeline input for one scheduled trip.
 */
export type TripBoundaryData = {
  key: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev?: string;
  arriveCurr: VesselTimelineBoundary;
  departCurr: VesselTimelineBoundary;
  arriveNext: VesselTimelineBoundary;
  departNext: VesselTimelineBoundary;
};

/**
 * Converts normalized vessel timeline trips into boundary-oriented data.
 *
 * @param trips - Ordered normalized vessel timeline trips
 * @returns Boundary-oriented representation of each trip
 */
export const getBoundaryData = (
  trips: VesselTimelineTrip[]
): TripBoundaryData[] =>
  trips.map((trip) => ({
    key: trip.key,
    departingTerminalAbbrev: trip.departingTerminalAbbrev,
    arrivingTerminalAbbrev: trip.arrivingTerminalAbbrev,
    arriveCurr: {
      terminalAbbrev: trip.departingTerminalAbbrev,
      timePoint: {
        scheduled: trip.scheduledArriveCurr,
        actual: trip.tripStart,
      } satisfies VesselTimelineTimePoint,
    },
    departCurr: {
      terminalAbbrev: trip.departingTerminalAbbrev,
      timePoint: {
        scheduled: trip.scheduledDeparture,
        actual: trip.leftDock,
        estimated: trip.predictedDepartCurr,
      } satisfies VesselTimelineTimePoint,
    },
    arriveNext: {
      terminalAbbrev:
        trip.arrivingTerminalAbbrev ?? trip.departingTerminalAbbrev,
      timePoint: {
        scheduled: trip.scheduledArrival,
        actual: trip.arriveDest ?? trip.tripEnd,
        estimated: trip.predictedArriveNext,
      } satisfies VesselTimelineTimePoint,
    },
    departNext: {
      terminalAbbrev:
        trip.arrivingTerminalAbbrev ?? trip.departingTerminalAbbrev,
      timePoint: {
        scheduled: trip.nextScheduledDeparture,
        estimated: trip.predictedDepartNext,
      } satisfies VesselTimelineTimePoint,
    },
  }));
