/**
 * Shared TimePoint helpers for timeline geometry and labels.
 */

import type { TimelineDocumentRow, TimePoint } from "../types";

const MIN_SEGMENT_MINUTES = 1;
const MS_PER_MINUTE = 60_000;

/**
 * Returns the display/countdown time for a boundary point.
 *
 * @param timePoint - Boundary point with scheduled, actual, and estimated times
 * @returns Actual time when available, otherwise estimated time
 */
export const getDisplayTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated;

/**
 * Returns the best available time for layout and duration calculations.
 *
 * @param timePoint - Boundary point with scheduled, actual, and estimated times
 * @returns Actual, estimated, or scheduled time in that priority order
 */
export const getBoundaryTime = (timePoint: TimePoint): Date | undefined =>
  timePoint.actual ?? timePoint.estimated ?? timePoint.scheduled;

/**
 * Calculates a segment duration from its boundary points when possible.
 *
 * @param row - Timeline row bounded by two TimePoints
 * @returns Duration in minutes from boundary times, or the segment fallback
 */
export const getSegmentDurationMinutes = (row: TimelineDocumentRow): number => {
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

/**
 * Calculates time-based progress for an active segment.
 *
 * @param row - Timeline row with start/end TimePoints
 * @param now - Current wall-clock time
 * @returns Normalized progress ratio between 0 and 1
 */
export const getSegmentTimeProgress = (
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
