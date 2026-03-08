/**
 * Builds canonical ordered timeline segments from vessel trip domain data.
 */

import { config, formatTerminalPairKey } from "convex/domain/ml/shared/config";
import type {
  TimelineItem,
  TimelineSegment,
  TimelineSegmentsModel,
  TimePoint,
} from "../types";

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
 * Builds the ordered segments for a vessel trip timeline card.
 *
 * @param item - Vessel trip and location pair
 * @returns Ordered canonical segment list
 */
export const buildTimelineSegments = (
  item: TimelineItem
): TimelineSegmentsModel => {
  const { trip } = item;
  const context = buildTimelineContext(item);
  const points = buildBoundaryPoints(item);
  const arrivingTerminalAbbrev = trip.ArrivingTerminalAbbrev ?? "";
  const departingTerminalAbbrev = trip.DepartingTerminalAbbrev;

  const segments: TimelineSegment[] = [
    {
      id: `${trip.VesselAbbrev}-at-dock-origin`,
      segmentIndex: 0,
      kind: "at-dock",
      startPoint: points.arriveOrigin,
      endPoint: points.departOrigin,
      startTerminalAbbrev: departingTerminalAbbrev,
      endTerminalAbbrev: departingTerminalAbbrev,
      fallbackDurationMinutes: context.defaultOriginDockMinutes,
    },
    {
      id: `${trip.VesselAbbrev}-at-sea`,
      segmentIndex: 1,
      kind: "at-sea",
      startPoint: points.departOrigin,
      endPoint: points.arriveNext,
      startTerminalAbbrev: departingTerminalAbbrev,
      endTerminalAbbrev: arrivingTerminalAbbrev,
      fallbackDurationMinutes: context.defaultAtSeaMinutes,
    },
    {
      id: `${trip.VesselAbbrev}-at-dock-dest`,
      segmentIndex: 2,
      kind: "at-dock",
      startPoint: points.arriveNext,
      endPoint: points.departNext,
      startTerminalAbbrev: arrivingTerminalAbbrev,
      endTerminalAbbrev: arrivingTerminalAbbrev,
      rendersEndLabel: true,
      fallbackDurationMinutes: context.defaultDestinationDockMinutes,
    },
  ];

  return {
    segments,
    activeSegmentIndex: getActiveSegmentIndex(item, segments.length),
  };
};

/**
 * Resolves the four boundary TimePoints used by today's three-segment card.
 *
 * @param item - Vessel trip and location pair
 * @returns Shared boundary points for ordered segments
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
 * Resolves the active segment cursor from current trip state.
 *
 * @param item - Vessel trip and location pair
 * @param segmentCount - Number of ordered segments
 * @returns Active segment index, `-1` before start, or `segmentCount` when complete
 */
const getActiveSegmentIndex = (
  item: TimelineItem,
  segmentCount: number
): number => {
  const { trip } = item;

  if (trip.AtDockDepartNext?.Actual) {
    return segmentCount;
  }

  if (trip.TripEnd) {
    return Math.max(0, segmentCount - 1);
  }

  if (trip.LeftDock) {
    return 1;
  }

  return 0;
};

/**
 * Resolves route-specific fallback durations for the current and next legs.
 *
 * @param item - Vessel trip and location pair
 * @returns Mean fallback durations for each rendered segment
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
