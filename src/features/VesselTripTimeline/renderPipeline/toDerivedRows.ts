/**
 * Pipeline stage: derive renderer-owned rows from ordered boundary events.
 */

import { config, formatTerminalPairKey } from "convex/domain/ml/shared/config";
import type {
  SegmentKind,
  TimelineEvent,
  TimelinePipelineWithEvents,
  TimelinePipelineWithRows,
  TimelineProgressMode,
  TimelineRow,
  TimePoint,
} from "../types";

const MIN_SEGMENT_MINUTES = 1;
const MS_PER_MINUTE = 60_000;

type EventPair = {
  startEvent: TimelineEvent;
  endEvent: TimelineEvent;
  pairIndex: number;
};

type TerminalPair = {
  departingTerminalAbbrev?: string;
  arrivingTerminalAbbrev?: string;
};

/**
 * Adds derived timeline rows to the pipeline context.
 *
 * @param input - Pipeline context containing ordered boundary events
 * @returns Pipeline context enriched with derived rows
 */
export const toDerivedRows = (
  input: TimelinePipelineWithEvents
): TimelinePipelineWithRows => {
  const { trip, vesselLocation } = input.item;
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
  const hasUsableDistanceProgress =
    vesselLocation.DepartingDistance !== undefined &&
    vesselLocation.ArrivingDistance !== undefined &&
    vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0;
  const eventPairs = input.events.slice(0, -1).map((startEvent, pairIndex) => ({
    startEvent,
    endEvent: input.events[pairIndex + 1],
    pairIndex,
  }));

  return {
    ...input,
    rows: eventPairs
      .map((pair) =>
        toTimelineRow(
          pair,
          trip.VesselAbbrev,
          currentPairKey,
          nextPairKey,
          hasUsableDistanceProgress
        )
      )
      .filter((row): row is TimelineRow => row !== null),
  };
};

/**
 * Converts one adjacent event pair into a derived row when the pair is valid.
 *
 * @param pair - Adjacent ordered event pair
 * @param vesselAbbrev - Vessel abbreviation used for stable row ids
 * @param currentPairKey - Current route pair key for fallback durations
 * @param nextPairKey - Next route pair key for fallback durations
 * @param hasUsableDistanceProgress - Whether telemetry supports distance progress
 * @returns Derived row, or `null` when the event pair is not renderable
 */
const toTimelineRow = (
  pair: EventPair,
  vesselAbbrev: string,
  currentPairKey: string,
  nextPairKey: string,
  hasUsableDistanceProgress: boolean
): TimelineRow | null => {
  const kind = getRowKind(pair.startEvent, pair.endEvent);

  if (!kind) {
    return null;
  }

  const fallbackDurationMinutes = getFallbackDurationMinutes(
    pair.pairIndex,
    kind,
    currentPairKey,
    nextPairKey
  );
  const progressMode: TimelineProgressMode =
    kind === "at-sea" && hasUsableDistanceProgress ? "distance" : "time";

  return {
    rowId: buildRowId(vesselAbbrev, pair.pairIndex, kind),
    kind,
    startEvent: pair.startEvent,
    endEvent: pair.endEvent,
    geometryMinutes: getGeometryMinutes(
      pair.startEvent.timePoint,
      pair.endEvent.timePoint,
      fallbackDurationMinutes
    ),
    fallbackDurationMinutes,
    progressMode,
  };
};

/**
 * Resolves the row kind from an adjacent event pair.
 *
 * @param startEvent - First event in the pair
 * @param endEvent - Second event in the pair
 * @returns Row kind, or `null` when the pair is not renderable
 */
const getRowKind = (
  startEvent: TimelineEvent,
  endEvent: TimelineEvent
): SegmentKind | null => {
  if (startEvent.eventType === "arrive" && endEvent.eventType === "depart") {
    return "at-dock";
  }

  if (startEvent.eventType === "depart" && endEvent.eventType === "arrive") {
    return "at-sea";
  }

  return null;
};

/**
 * Builds a stable row id from the pair position and row kind.
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param pairIndex - Index of the adjacent event pair
 * @param kind - Derived row kind
 * @returns Stable row identifier
 */
const buildRowId = (
  vesselAbbrev: string,
  pairIndex: number,
  kind: SegmentKind
) => `${vesselAbbrev}-row-${pairIndex}-${kind}`;

/**
 * Resolves fallback geometry minutes for one derived row.
 *
 * @param pairIndex - Index of the adjacent event pair
 * @param kind - Derived row kind
 * @param currentPairKey - Current route pair key
 * @param nextPairKey - Next route pair key
 * @returns Fallback minutes for the row geometry
 */
const getFallbackDurationMinutes = (
  pairIndex: number,
  kind: SegmentKind,
  currentPairKey: string,
  nextPairKey: string
) => {
  if (kind === "at-sea") {
    return config.getMeanAtSeaDuration(currentPairKey);
  }

  return config.getMeanAtDockDuration(
    pairIndex === 0 ? currentPairKey : nextPairKey
  );
};

/**
 * Returns the best available time for layout and duration calculations.
 *
 * @param timePoint - Boundary point with scheduled, actual, and estimated times
 * @returns Actual, estimated, or scheduled time in that priority order
 */
const getBoundaryTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated ?? timePoint.scheduled;

/**
 * Calculates geometry minutes for one derived row.
 *
 * @param startPoint - Row start timepoint
 * @param endPoint - Row end timepoint
 * @param fallbackDurationMinutes - Fallback geometry duration
 * @returns Geometry minutes used by the renderer
 */
const getGeometryMinutes = (
  startPoint: TimePoint,
  endPoint: TimePoint,
  fallbackDurationMinutes: number
) => {
  const startTime = getBoundaryTime(startPoint);
  const endTime = getBoundaryTime(endPoint);

  if (!startTime || !endTime) {
    return Math.max(MIN_SEGMENT_MINUTES, fallbackDurationMinutes);
  }

  const durationMinutes =
    (endTime.getTime() - startTime.getTime()) / MS_PER_MINUTE;

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return Math.max(MIN_SEGMENT_MINUTES, fallbackDurationMinutes);
  }

  return Math.max(MIN_SEGMENT_MINUTES, durationMinutes);
};

/**
 * Parses a scheduled trip key to extract departing and arriving terminals.
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
