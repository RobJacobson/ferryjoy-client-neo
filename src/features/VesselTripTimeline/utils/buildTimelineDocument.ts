/**
 * Builds the canonical timeline document for a vessel trip card.
 */

import { config, formatTerminalPairKey } from "convex/domain/ml/shared/config";
import type {
  TimelineDocument,
  TimelineDocumentRow,
  TimelineItem,
  TimePoint,
} from "../types";
import { getSegmentDurationMinutes } from "./timePoints";

type TimelineContext = {
  defaultOriginDockMinutes: number;
  defaultAtSeaMinutes: number;
  defaultDestinationDockMinutes: number;
};

type TerminalPair = {
  departingTerminalAbbrev?: string;
  arrivingTerminalAbbrev?: string;
};

/**
 * Builds the canonical timeline document consumed by the render-state selector.
 *
 * @param item - Vessel trip and location pair
 * @returns Ordered document rows plus the active row cursor
 */
export const buildTimelineDocument = (item: TimelineItem): TimelineDocument => {
  const { trip, vesselLocation } = item;
  const context = buildTimelineContext(item);
  const points = buildBoundaryPoints(item);
  const arrivingTerminalAbbrev = trip.ArrivingTerminalAbbrev ?? "";
  const departingTerminalAbbrev = trip.DepartingTerminalAbbrev;
  const useDistanceProgress =
    vesselLocation.DepartingDistance !== undefined &&
    vesselLocation.ArrivingDistance !== undefined &&
    vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0;

  const baseRows: TimelineDocumentRow[] = [
    {
      id: `${trip.VesselAbbrev}-at-dock-origin`,
      segmentIndex: 0,
      kind: "at-dock",
      startBoundary: {
        terminalAbbrev: departingTerminalAbbrev,
        timePoint: points.arriveOrigin,
      },
      endBoundary: {
        terminalAbbrev: departingTerminalAbbrev,
        timePoint: points.departOrigin,
      },
      geometryMinutes: 0,
      fallbackDurationMinutes: context.defaultOriginDockMinutes,
      progressMode: "time",
    },
    {
      id: `${trip.VesselAbbrev}-at-sea`,
      segmentIndex: 1,
      kind: "at-sea",
      startBoundary: {
        terminalAbbrev: departingTerminalAbbrev,
        timePoint: points.departOrigin,
      },
      endBoundary: {
        terminalAbbrev: arrivingTerminalAbbrev,
        timePoint: points.arriveNext,
      },
      geometryMinutes: 0,
      fallbackDurationMinutes: context.defaultAtSeaMinutes,
      progressMode: useDistanceProgress ? "distance" : "time",
    },
    {
      id: `${trip.VesselAbbrev}-at-dock-dest`,
      segmentIndex: 2,
      kind: "at-dock",
      startBoundary: {
        terminalAbbrev: arrivingTerminalAbbrev,
        timePoint: points.arriveNext,
      },
      endBoundary: {
        terminalAbbrev: arrivingTerminalAbbrev,
        timePoint: points.departNext,
      },
      geometryMinutes: 0,
      fallbackDurationMinutes: context.defaultDestinationDockMinutes,
      progressMode: "time",
    },
  ];
  const rows = baseRows.map((row) => ({
    ...row,
    geometryMinutes: getSegmentDurationMinutes(row),
  }));

  return {
    rows,
    activeSegmentIndex: getActiveSegmentIndex(item, rows.length),
  };
};

/**
 * Resolves the boundary TimePoints used by the three-row timeline.
 *
 * @param item - Vessel trip and location pair
 * @returns Shared boundary points for ordered document rows
 */
const buildBoundaryPoints = (item: TimelineItem) => {
  const { trip, vesselLocation } = item;

  return {
    departOrigin: {
      actual: vesselLocation.LeftDock ?? trip.LeftDock,
      estimated: trip.AtDockDepartCurr?.PredTime,
      scheduled:
        trip.ScheduledTrip?.DepartingTime ??
        trip.ScheduledDeparture ??
        vesselLocation.ScheduledDeparture,
    } satisfies TimePoint,
    arriveOrigin: {
      scheduled: trip.ScheduledTrip?.SchedArriveCurr,
      actual: trip.TripStart,
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
 * Resolves the active row cursor from current trip state.
 *
 * @param item - Vessel trip and location pair
 * @param rowCount - Number of ordered rows
 * @returns Active row index, or `rowCount` when the timeline is complete
 */
const getActiveSegmentIndex = (
  item: TimelineItem,
  rowCount: number
): number => {
  const { trip } = item;

  if (trip.AtDockDepartNext?.Actual) {
    return rowCount;
  }

  if (trip.TripEnd) {
    return Math.max(0, rowCount - 1);
  }

  if (trip.LeftDock) {
    return 1;
  }

  return 0;
};

/**
 * Resolves route-specific fallback durations for each segment.
 *
 * @param item - Vessel trip and location pair
 * @returns Mean fallback durations for each rendered row
 */
const buildTimelineContext = (item: TimelineItem): TimelineContext => {
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
      : currentPairKey;

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
