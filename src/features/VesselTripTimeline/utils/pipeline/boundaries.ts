/**
 * Pipeline stage 1: extract boundary points and fallback context from item.
 * Output is the input for the rows stage.
 */

import { config, formatTerminalPairKey } from "convex/domain/ml/shared/config";
import type { TimelineItem, TimePoint } from "../../types";

export type BoundaryPoints = {
  departOrigin: TimePoint;
  arriveOrigin: TimePoint;
  arriveNext: TimePoint;
  departNext: TimePoint;
};

export type FallbackContext = {
  defaultOriginDockMinutes: number;
  defaultAtSeaMinutes: number;
  defaultDestinationDockMinutes: number;
};

export type BoundaryData = {
  boundaryPoints: BoundaryPoints;
  fallbackContext: FallbackContext;
};

type TerminalPair = {
  departingTerminalAbbrev?: string;
  arrivingTerminalAbbrev?: string;
};

/**
 * Extracts boundary TimePoints and fallback durations from a vessel trip item.
 *
 * @param item - Vessel trip and location pair
 * @returns BoundaryData for the rows stage
 */
export const getBoundaries = (item: TimelineItem): BoundaryData => ({
  boundaryPoints: buildBoundaryPoints(item),
  fallbackContext: buildTimelineContext(item),
});

/**
 * Resolves the boundary TimePoints used by the three-row timeline.
 *
 * @param item - Vessel trip and location pair
 * @returns Shared boundary points for ordered document rows
 */
const buildBoundaryPoints = (item: TimelineItem): BoundaryPoints => {
  const { trip, vesselLocation } = item;

  return {
    arriveOrigin: {
      scheduled: trip.ScheduledTrip?.SchedArriveCurr,
      actual: trip.TripStart,
    } satisfies TimePoint,
    departOrigin: {
      actual: vesselLocation.LeftDock ?? trip.LeftDock,
      estimated: trip.AtDockDepartCurr?.PredTime,
      scheduled:
        trip.ScheduledTrip?.DepartingTime ??
        trip.ScheduledDeparture ??
        vesselLocation.ScheduledDeparture,
    } satisfies TimePoint,
    arriveNext: {
      actual: trip.TripEnd,
      estimated:
        vesselLocation.Eta ??
        trip.AtSeaArriveNext?.PredTime ??
        trip.AtDockArriveNext?.PredTime,
      scheduled:
        trip.ScheduledTrip?.SchedArriveNext ?? trip.ScheduledTrip?.ArrivingTime,
    } satisfies TimePoint,
    departNext: {
      actual: trip.AtDockDepartNext?.Actual,
      estimated:
        trip.AtDockDepartNext?.PredTime ?? trip.AtSeaDepartNext?.PredTime,
      scheduled: trip.ScheduledTrip?.NextDepartingTime,
    } satisfies TimePoint,
  };
};

/**
 * Resolves route-specific fallback durations for each segment.
 *
 * @param item - Vessel trip and location pair
 * @returns Mean fallback durations for each rendered row
 */
const buildTimelineContext = (item: TimelineItem): FallbackContext => {
  const { trip } = item;
  const currentPairKey = trip.ArrivingTerminalAbbrev
    ? formatTerminalPairKey(
        trip.DepartingTerminalAbbrev,
        trip.ArrivingTerminalAbbrev
      )
    : "";
  const nextPair = parseTerminalPairFromKey(trip.ScheduledTrip?.NextKey);
  const nextPairKey =
    nextPair.departingTerminalAbbrev && nextPair.arrivingTerminalAbbrev
      ? formatTerminalPairKey(
          nextPair.departingTerminalAbbrev,
          nextPair.arrivingTerminalAbbrev
        )
      : "";

  return {
    defaultOriginDockMinutes: config.getMeanAtDockDuration(currentPairKey),
    defaultAtSeaMinutes: config.getMeanAtSeaDuration(currentPairKey),
    defaultDestinationDockMinutes: config.getMeanAtDockDuration(nextPairKey),
  };
};

/**
 * Parses a scheduled trip key to extract departing and arriving terminals.
 * Key format: [VesselAbbrev]--[PacificDate]--[PacificTime]--[Departing]-[Arriving]
 *
 * @param key - Trip key to parse
 * @returns Parsed terminal pair when available
 */
const parseTerminalPairFromKey = (key: string | undefined): TerminalPair => {
  if (!key) {
    return {};
  }

  const parts = key.split("--");
  if (parts.length < 4) {
    return {};
  }

  const terminalPair = parts[3];
  const [departingTerminalAbbrev, arrivingTerminalAbbrev] =
    terminalPair.split("-");

  return {
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
  };
};
