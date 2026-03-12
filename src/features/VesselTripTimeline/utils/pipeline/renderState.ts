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

  if (row.progressMode === "distance" && row.kind === "at-sea") {
    return getDistanceProgress(
      item.vesselLocation.DepartingDistance,
      item.vesselLocation.ArrivingDistance
    );
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
 * @param departingDistance - Remaining distance from the departure terminal
 * @param arrivingDistance - Remaining distance to the arrival terminal
 * @returns Clamped distance ratio between 0 and 1
 */
const getDistanceProgress = (
  departingDistance: number | undefined,
  arrivingDistance: number | undefined
): number => {
  if (
    departingDistance === undefined ||
    arrivingDistance === undefined ||
    departingDistance + arrivingDistance <= 0
  ) {
    return 0;
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
    rowIndex: activeRow.segmentIndex,
    positionPercent,
    label: getMinutesUntil(
      getDisplayTime(activeRow.endBoundary.timePoint),
      now
    ),
  };
};
