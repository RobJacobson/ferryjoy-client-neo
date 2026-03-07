/**
 * Math and validation utilities for Timeline primitives.
 *
 * Provides validation for TimelineRow models to ensure data integrity:
 * - Percent values must be finite numbers in range [0, 1]
 * - Date values must be finite and valid
 * - End times must be greater than start times
 *
 * Validation errors are thrown early with descriptive messages to aid debugging.
 */

import type { TimelineRow } from "./TimelineTypes";

const MS_PER_MINUTE = 60_000;

/**
 * Normalizes and validates row completion value.
 *
 * @param row - Timeline row
 * @returns Percent complete in range [0, 1]
 */
export const getValidatedPercentComplete = (row: TimelineRow): number => {
  // Validate percentComplete is a finite number
  if (!Number.isFinite(row.percentComplete)) {
    throw new Error(
      `Timeline row "${row.id}" has invalid percentComplete: ${row.percentComplete}.`
    );
  }
  // Validate percentComplete is within valid range
  if (row.percentComplete < 0 || row.percentComplete > 1) {
    throw new Error(
      `Timeline row "${row.id}" percentComplete must be between 0 and 1.`
    );
  }
  return row.percentComplete;
};

/**
 * Computes row duration in minutes and validates time ordering.
 *
 * @param row - Timeline row
 * @returns Duration in minutes
 */
export const getDurationMinutes = (row: TimelineRow): number => {
  const startTimeMs = row.startTime.getTime();
  const endTimeMs = row.endTime.getTime();
  // Validate Date values are finite
  if (!Number.isFinite(startTimeMs) || !Number.isFinite(endTimeMs)) {
    throw new Error(`Timeline row "${row.id}" has invalid Date values.`);
  }
  // Validate endTime is after startTime for positive duration
  if (endTimeMs <= startTimeMs) {
    throw new Error(
      `Timeline row "${row.id}" has invalid time range: endTime must be greater than startTime.`
    );
  }
  // Convert milliseconds to minutes
  return (endTimeMs - startTimeMs) / MS_PER_MINUTE;
};

/**
 * Returns whether a moving indicator should render for this row.
 *
 * @param percentComplete - Completion value in range [0, 1]
 * @returns True when row is in progress
 */
export const shouldShowMovingIndicator = (percentComplete: number): boolean =>
  percentComplete > 0 && percentComplete < 1;
