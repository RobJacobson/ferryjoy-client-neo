/**
 * Pure functions for building TimePoint values from timeline data.
 */

import type { TimePoint } from "../types";

/**
 * Builds a TimePoint from scheduled, actual, and estimated values.
 *
 * @param scheduled - Scheduled time (required)
 * @param actual - Actual time (optional)
 * @param estimated - Estimated/predicted time (optional)
 * @returns TimePoint for event display
 */
export const buildTimePoint = (
  scheduled: Date,
  actual?: Date,
  estimated?: Date
): TimePoint => ({
  scheduled,
  actual,
  estimated,
});
