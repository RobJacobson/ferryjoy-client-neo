/**
 * Time-based progress helpers for UI components.
 * Centralizes progress math so multiple components can share consistent semantics.
 */

import { clamp } from "../../../shared/utils/clamp";

// ============================================================================
// Types
// ============================================================================

export type TimeProgressStatus = "Pending" | "InProgress" | "Completed";

// ============================================================================
// Public Helpers
// ============================================================================

/**
 * Calculates progress value based on time range and status.
 *
 * Semantics:
 * - Pending: always 0
 * - Completed: always 1 (even if times are missing)
 * - InProgress: 0 if missing/invalid times; otherwise proportional progress
 *
 * @param status - Current status of the progress segment
 * @param nowMs - Current time in milliseconds
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @returns Progress value between 0 and 1
 */
export const calculateTimeProgress = ({
  status,
  nowMs,
  startTimeMs,
  endTimeMs,
}: {
  status: TimeProgressStatus;
  nowMs: number;
  startTimeMs?: number;
  endTimeMs?: number;
}): number => {
  if (status === "Pending") {
    return 0;
  }

  if (status === "Completed") {
    return 1;
  }

  if (startTimeMs === undefined || endTimeMs === undefined) {
    return 0;
  }

  if (endTimeMs <= startTimeMs) {
    return nowMs >= endTimeMs ? 1 : 0;
  }

  if (nowMs >= endTimeMs) {
    return 1;
  }

  return clamp((nowMs - startTimeMs) / (endTimeMs - startTimeMs), 0, 1);
};

/**
 * Computes minutes remaining until an end timestamp.
 * Returns undefined when the end timestamp is missing.
 *
 * @param nowMs - Current time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @returns Minutes remaining, or undefined if end time is missing
 */
export const getMinutesRemaining = ({
  nowMs,
  endTimeMs,
}: {
  nowMs: number;
  endTimeMs?: number;
}): number | undefined => {
  if (endTimeMs === undefined) {
    return undefined;
  }
  return Math.max(0, Math.ceil((endTimeMs - nowMs) / (1000 * 60)));
};

