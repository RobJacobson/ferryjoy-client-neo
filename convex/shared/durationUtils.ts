// ============================================================================
// DURATION CALCULATION UTILITIES
// Shared functions for calculating trip durations in minutes
// ============================================================================

/**
 * Calculate the time delta in minutes between two timestamps (in milliseconds).
 *
 * @param startTimeMs - Start time in epoch milliseconds
 * @param endTimeMs - End time in epoch milliseconds
 * @returns Duration in minutes (can be negative if endTime < startTime)
 */
export const getMinutesDelta = (
  startTimeMs: number | undefined,
  endTimeMs: number | undefined
): number | undefined => {
  if (!startTimeMs || !endTimeMs) {
    return undefined;
  }
  return (endTimeMs - startTimeMs) / (1000 * 60);
};

/**
 * Rounds a number to a specified precision.
 *
 * This utility function provides controlled rounding by multiplying the value by the
 * precision factor, rounding to the nearest integer, and then dividing back.
 *
 * @param value - The numeric value to round
 * @param precision - The precision factor (e.g., 1 for 1 decimal place, 2 for 2 decimal places)
 * @returns The rounded number
 */
export const roundToPrecision = (
  value: number,
  precision: number = 0
): number => Math.round(value * 10 ** precision) / 10 ** precision;

/**
 * Calculates the time delta in minutes between two times.
 *
 * This function computes the difference between the second time and the first time,
 * returning the time delta in minutes rounded to one decimal place.
 *
 * @param firstTime - First time in milliseconds since epoch
 * @param secondTime - Second time in milliseconds since epoch
 * @returns Time delta in minutes (rounded to one decimal place), or `undefined` if either parameter is invalid or missing
 */
export const calculateTimeDelta = (
  firstTime: number | undefined,
  secondTime: number | undefined
): number | undefined => {
  const delta = getMinutesDelta(firstTime, secondTime);
  return delta !== undefined ? roundToPrecision(delta, 1) : undefined;
};

/**
 * Rounds a timestamp upward to the next minute boundary.
 *
 * Since departing times are whole minutes and mean durations are fractional,
 * this will always round up fractional minutes to the next whole minute.
 * Example: 22:45:10 → 22:46:00
 *
 * @param timeMs - Time in epoch milliseconds
 * @returns Time rounded up to next minute boundary
 */
export const roundUpToNextMinute = (timeMs: number): number => {
  const date = new Date(timeMs);
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();

  // Always round up to next minute boundary if any fractional seconds exist
  if (seconds > 0 || milliseconds > 0) {
    date.setMinutes(date.getMinutes() + 1);
    date.setSeconds(0);
    date.setMilliseconds(0);
  }

  return date.getTime();
};
