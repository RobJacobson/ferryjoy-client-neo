/**
 * Pipeline stage 2: build document rows with geometry from boundary data.
 * Output is the input for the document stage.
 */

import type { TimelineDocumentRow, TimelineItem, TimePoint } from "../../types";
import type {
  BoundaryData,
  BoundaryPoints,
  FallbackContext,
} from "./boundaries";

const MIN_SEGMENT_MINUTES = 1;
const MS_PER_MINUTE = 60_000;

/**
 * Builds ordered document rows with geometry from boundary data and item.
 *
 * @param boundaryData - Output from the boundaries stage
 * @param item - Vessel trip and location pair
 * @returns Document rows with geometryMinutes set (input for document stage)
 */
export const getRows = (
  boundaryData: BoundaryData,
  item: TimelineItem
): TimelineDocumentRow[] => {
  const { trip, vesselLocation } = item;
  const { boundaryPoints, fallbackContext } = boundaryData;
  const arrivingTerminalAbbrev = trip.ArrivingTerminalAbbrev ?? "";
  const departingTerminalAbbrev = trip.DepartingTerminalAbbrev;
  const hasUsableDistanceProgress =
    vesselLocation.DepartingDistance !== undefined &&
    vesselLocation.ArrivingDistance !== undefined &&
    vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0;

  const baseRows: TimelineDocumentRow[] = [
    buildOriginDockRow(
      trip.VesselAbbrev,
      departingTerminalAbbrev,
      boundaryPoints,
      fallbackContext
    ),
    buildAtSeaRow(
      trip.VesselAbbrev,
      departingTerminalAbbrev,
      arrivingTerminalAbbrev,
      boundaryPoints,
      fallbackContext,
      hasUsableDistanceProgress
    ),
    buildDestinationDockRow(
      trip.VesselAbbrev,
      arrivingTerminalAbbrev,
      boundaryPoints,
      fallbackContext
    ),
  ];

  return baseRows.map((row) => ({
    ...row,
    geometryMinutes: getSegmentDurationMinutes(row),
  }));
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
 * Calculates a segment duration from its boundary points when possible.
 *
 * @param row - Timeline row bounded by two TimePoints
 * @returns Duration in minutes from boundary times, or the segment fallback
 */
const getSegmentDurationMinutes = (
  row: Omit<TimelineDocumentRow, "geometryMinutes"> & {
    geometryMinutes?: number;
    startBoundary: { timePoint: TimePoint };
    endBoundary: { timePoint: TimePoint };
    fallbackDurationMinutes: number;
  }
): number => {
  const startTime = getBoundaryTime(row.startBoundary.timePoint);
  const endTime = getBoundaryTime(row.endBoundary.timePoint);

  if (!startTime || !endTime) {
    return Math.max(MIN_SEGMENT_MINUTES, row.fallbackDurationMinutes);
  }

  const durationMinutes =
    (endTime.getTime() - startTime.getTime()) / MS_PER_MINUTE;

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return Math.max(MIN_SEGMENT_MINUTES, row.fallbackDurationMinutes);
  }

  return Math.max(MIN_SEGMENT_MINUTES, durationMinutes);
};

const buildOriginDockRow = (
  vesselAbbrev: string,
  departingTerminalAbbrev: string | undefined,
  points: BoundaryPoints,
  context: FallbackContext
): TimelineDocumentRow => ({
  id: `${vesselAbbrev}-at-dock-origin`,
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
});

const buildAtSeaRow = (
  vesselAbbrev: string,
  departingTerminalAbbrev: string | undefined,
  arrivingTerminalAbbrev: string,
  points: BoundaryPoints,
  context: FallbackContext,
  hasUsableDistanceProgress: boolean
): TimelineDocumentRow => ({
  id: `${vesselAbbrev}-at-sea`,
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
  progressMode: hasUsableDistanceProgress ? "distance" : "time",
});

const buildDestinationDockRow = (
  vesselAbbrev: string,
  arrivingTerminalAbbrev: string,
  points: BoundaryPoints,
  context: FallbackContext
): TimelineDocumentRow => ({
  id: `${vesselAbbrev}-at-dock-dest`,
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
});
