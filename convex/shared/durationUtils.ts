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
 * Round a duration to one decimal place.
 *
 * @param duration - Duration in minutes
 * @returns Duration rounded to one decimal place
 */
const roundToOneDecimal = (duration: number): number =>
  Math.round(duration * 10) / 10;

/**
 * Calculate the AtDockDuration for a trip.
 * This is the time from when the trip started until the vessel left the dock.
 *
 * @param tripStart - Trip start timestamp in epoch milliseconds
 * @param leftDock - Time when vessel left the dock (epoch milliseconds)
 * @returns AtDockDuration in minutes (rounded to one decimal place), or undefined if either timestamp is missing
 */
export const calculateAtDockDuration = (
  tripStart: number | undefined,
  leftDock: number | undefined
): number | undefined => {
  const duration = getMinutesDelta(tripStart, leftDock);
  return duration !== undefined ? roundToOneDecimal(duration) : undefined;
};

/**
 * Calculate the AtSeaDuration for a trip.
 * This is the time from when the vessel left the dock until the trip ended.
 *
 * @param leftDock - Time when vessel left the dock (epoch milliseconds)
 * @param tripEnd - Trip end timestamp in epoch milliseconds
 * @returns AtSeaDuration in minutes (rounded to one decimal place), or undefined if either timestamp is missing
 */
export const calculateAtSeaDuration = (
  leftDock: number | undefined,
  tripEnd: number | undefined
): number | undefined => {
  const duration = getMinutesDelta(leftDock, tripEnd);
  return duration !== undefined ? roundToOneDecimal(duration) : undefined;
};

/**
 * Calculate the TotalDuration for a trip.
 * This is the time from when the trip started until it ended.
 *
 * @param tripStart - Trip start timestamp in epoch milliseconds
 * @param tripEnd - Trip end timestamp in epoch milliseconds
 * @returns TotalDuration in minutes (rounded to one decimal place), or undefined if either timestamp is missing
 */
export const calculateTotalDuration = (
  tripStart: number | undefined,
  tripEnd: number | undefined
): number | undefined => {
  const duration = getMinutesDelta(tripStart, tripEnd);
  return duration !== undefined ? roundToOneDecimal(duration) : undefined;
};
