/**
 * Timeline layout computation: progress, duration, minutes remaining.
 * Used by TimelineBarAtDock and TimelineBarAtSea.
 */

import type { TimelineBarStatus } from "../types";

const MS_PER_MINUTE = 60000;

/**
 * Computes all layout and progress data for a timeline bar in one go.
 * Consolidates duration, progress, and remaining time calculations.
 *
 * @param status - Timeline bar status
 * @param nowMs - Current time in milliseconds
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @param predictionEndTimeMs - Optional predicted end time in milliseconds
 * @returns Object containing progress, minutesRemaining, and duration
 */
export const getTimelineLayout = ({
  status,
  nowMs,
  startTimeMs,
  endTimeMs,
  predictionEndTimeMs,
}: {
  status: TimelineBarStatus;
  nowMs: number;
  startTimeMs?: number;
  endTimeMs?: number;
  predictionEndTimeMs?: number;
}) => {
  // 1. Primary Guard: If status is Pending, progress MUST be 0.
  if (status === "Pending") {
    return {
      progress: 0,
      minutesRemaining: undefined,
      duration:
        startTimeMs !== undefined && endTimeMs !== undefined
          ? Math.round(
              (Math.max(MS_PER_MINUTE * 5, endTimeMs - startTimeMs) /
                MS_PER_MINUTE) *
                100
            ) / 100
          : undefined,
    };
  }

  // 2. Calculate Duration (FlexGrow)
  // We always use scheduled times for the layout width to keep the timeline consistent
  const durationMs =
    startTimeMs !== undefined && endTimeMs !== undefined
      ? Math.max(MS_PER_MINUTE * 5, endTimeMs - startTimeMs) // Minimum 5 minutes for spacing
      : undefined;
  const duration =
    durationMs !== undefined
      ? Math.round((durationMs / MS_PER_MINUTE) * 100) / 100
      : undefined;

  // 3. Calculate Minutes Remaining
  // Use prediction if available, otherwise scheduled end time
  const effectiveEndTimeMs = predictionEndTimeMs ?? endTimeMs;
  const remainingMs =
    effectiveEndTimeMs !== undefined ? effectiveEndTimeMs - nowMs : undefined;

  // For in-progress segments, we want to show the minutes remaining until the effective end time.
  const minutesRemaining =
    status === "InProgress" && remainingMs !== undefined
      ? Math.max(0, Math.ceil(remainingMs / MS_PER_MINUTE))
      : undefined;

  // 4. Calculate Progress (0-1)
  let progress = 0;

  if (status === "Completed") {
    progress = 1;
  } else if (
    status === "InProgress" &&
    startTimeMs !== undefined &&
    effectiveEndTimeMs !== undefined
  ) {
    // If we haven't reached the start time yet, progress is 0.
    // This handles the "Arrived at dock but scheduled departure is in the future" case.
    if (nowMs < startTimeMs) {
      progress = 0;
    } else {
      const progressDurationMs = Math.max(
        durationMs ?? 0,
        effectiveEndTimeMs - startTimeMs
      );
      if (progressDurationMs > 0) {
        progress = Math.min(1, (nowMs - startTimeMs) / progressDurationMs);
      }
    }
  }

  return {
    progress,
    minutesRemaining,
    duration,
  };
};
