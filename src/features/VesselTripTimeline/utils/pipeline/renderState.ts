/**
 * Pipeline stage 5: compute active indicator and assemble final render state.
 * Combines render rows from stage 4 with the active overlay indicator.
 */

import { clamp } from "@/shared/utils";
import type {
  TimelineActiveIndicator,
  TimelineDocument,
  TimelineDocumentRow,
  TimelineItem,
  TimelineRenderRow,
  TimelineRenderState,
  TimePoint,
} from "../../types";

const ACTIVE_DOCK_MIN_OFFSET = 0.06;
const MOVING_SPEED_THRESHOLD_KNOTS = 0.1;

/**
 * Assembles final render state from document, render rows, and active indicator.
 *
 * @param document - Output from the document stage
 * @param renderRows - Output from the renderRows stage
 * @param item - Vessel trip and location pair
 * @param now - Current wall-clock time
 * @returns TimelineRenderState for the UI
 */
export const renderState = (
  document: TimelineDocument,
  renderRows: TimelineRenderRow[],
  item: TimelineItem,
  now: Date
): TimelineRenderState => ({
  rows: renderRows,
  activeIndicator: getActiveIndicator(document, item, now),
});

/**
 * Returns the display/countdown time for a boundary point.
 *
 * @param timePoint - Boundary point with scheduled, actual, and estimated times
 * @returns Actual time when available, otherwise estimated time
 */
const getDisplayTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated;

/**
 * Returns the best available time for progress calculations.
 *
 * @param timePoint - Boundary point with scheduled, actual, and estimated times
 * @returns Actual, estimated, or scheduled time in that priority order
 */
const getBoundaryTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated ?? timePoint.scheduled;

/**
 * Calculates time-based progress for an active segment.
 *
 * @param row - Timeline row with start/end TimePoints
 * @param now - Current wall-clock time
 * @returns Normalized progress ratio between 0 and 1
 */
const getSegmentTimeProgress = (
  row: TimelineDocumentRow,
  now: Date
): number => {
  const startTime = getBoundaryTime(row.startBoundary.timePoint);
  const endTime = getBoundaryTime(row.endBoundary.timePoint);

  if (!startTime || !endTime) {
    return 0;
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs <= 0) {
    return 0;
  }

  const elapsedMs = now.getTime() - startTime.getTime();
  return Math.max(0, Math.min(1, elapsedMs / durationMs));
};

/**
 * Returns preferred progress for an at-sea row: distance when telemetry is
 * usable, otherwise time-based fallback from the row boundaries.
 */
const getAtSeaProgress = (
  row: TimelineDocumentRow,
  item: TimelineItem,
  now: Date
): number => {
  const distanceProgress =
    row.progressMode === "distance"
      ? getDistanceProgress(
          item.vesselLocation.DepartingDistance,
          item.vesselLocation.ArrivingDistance
        )
      : null;

  return distanceProgress ?? getSegmentTimeProgress(row, now);
};

/**
 * Produces a short minutes-until label for indicator content.
 *
 * @param targetTime - Target timestamp (undefined means no data available)
 * @param now - Current time
 * @returns Remaining minutes label or "--" if no data
 */
const getMinutesUntil = (targetTime: Date | undefined, now: Date): string => {
  if (targetTime === undefined) {
    return "--";
  }
  const remainingMs = targetTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  return `${remainingMinutes}m`;
};

/**
 * Resolves the row that currently owns the active indicator.
 *
 * @param document - Canonical ordered timeline document
 * @returns Active row, or undefined when the document has no rows
 */
const getActiveTimelineRow = (
  document: TimelineDocument
): TimelineDocumentRow | undefined => {
  const { rows, activeSegmentIndex } = document;

  if (rows.length === 0) {
    return undefined;
  }

  if (activeSegmentIndex < 0) {
    return rows.at(0);
  }

  if (activeSegmentIndex >= rows.length) {
    return rows.at(-1);
  }

  return rows.at(activeSegmentIndex);
};

/**
 * Calculates active-indicator progress for the owning row.
 *
 * @param row - Active row that owns the indicator
 * @param document - Canonical timeline document
 * @param item - Vessel trip and telemetry data
 * @param now - Current wall-clock time
 * @returns Row-local indicator position between 0 and 1
 */
const getIndicatorPositionPercent = (
  row: TimelineDocumentRow,
  document: TimelineDocument,
  item: TimelineItem,
  now: Date
): number => {
  if (document.activeSegmentIndex >= document.rows.length) {
    return 1;
  }

  if (document.activeSegmentIndex < 0) {
    return 0;
  }

  if (row.kind === "at-sea") {
    return getAtSeaProgress(row, item, now);
  }

  const timeProgress = getSegmentTimeProgress(row, now);

  if (row.kind === "at-dock" && row.segmentIndex === 0) {
    return Math.max(ACTIVE_DOCK_MIN_OFFSET, timeProgress);
  }

  return timeProgress;
};

/**
 * Calculates distance-based in-transit progress when telemetry is available.
 *
 * @param departingDistance - Distance from the vessel to the departing terminal
 * @param arrivingDistance - Distance from the vessel to the arriving terminal
 * @returns Clamped distance ratio between 0 and 1, or null when unavailable
 */
const getDistanceProgress = (
  departingDistance: number | undefined,
  arrivingDistance: number | undefined
): number | null => {
  if (
    departingDistance === undefined ||
    arrivingDistance === undefined ||
    departingDistance + arrivingDistance <= 0
  ) {
    return null;
  }

  return clamp(
    departingDistance / (departingDistance + arrivingDistance),
    0,
    1
  );
};

/**
 * Derives the overlay indicator for the currently active row.
 *
 * @param document - Canonical timeline document
 * @param item - Vessel trip and telemetry data
 * @param now - Current wall-clock time
 * @returns Active overlay indicator, or null when no rows exist
 */
const getActiveIndicator = (
  document: TimelineDocument,
  item: TimelineItem,
  now: Date
): TimelineActiveIndicator | null => {
  const activeRow = getActiveTimelineRow(document);

  if (!activeRow) {
    return null;
  }

  const positionPercent = getIndicatorPositionPercent(
    activeRow,
    document,
    item,
    now
  );

  return {
    rowId: activeRow.id,
    positionPercent,
    label: getMinutesUntil(
      getDisplayTime(activeRow.endBoundary.timePoint),
      now
    ),
    title: item.vesselLocation.VesselName,
    subtitle: getIndicatorSubtitle(activeRow, item),
    animate:
      activeRow.kind === "at-sea" &&
      (item.vesselLocation.Speed ?? 0) > MOVING_SPEED_THRESHOLD_KNOTS,
    speedKnots: item.vesselLocation.Speed ?? 0,
  };
};

const getIndicatorSubtitle = (
  row: TimelineDocumentRow,
  item: TimelineItem
): string => {
  if (row.kind === "at-dock") {
    return "at dock";
  }

  const speed = item.vesselLocation.Speed ?? 0;
  const arrivingDistance = item.vesselLocation.ArrivingDistance;
  if (arrivingDistance === undefined) {
    return `${speed.toFixed(0)} kn`;
  }

  return `${speed.toFixed(0)} kn · ${arrivingDistance.toFixed(1)} mi`;
};
