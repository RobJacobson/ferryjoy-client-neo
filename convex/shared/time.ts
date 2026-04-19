// ============================================================================
// SHARED TIME UTILITY FUNCTIONS
// Core time-related functions used across the application
// ============================================================================

// Timezone formatters for America/Los_Angeles (Pacific Time)
// Using separate formatters for better performance and cleaner code
const PACIFIC_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour12: false, // Get 24-hour format directly
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

const PACIFIC_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
});

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Extract Pacific time components from a UTC date using Intl API
 * This properly handles DST transitions for any year without manual calculations
 *
 * @param utcDate - UTC date to convert
 * @returns Object with hour, minute, second, and day of week in Pacific time
 */
export const getPacificTimeComponents = (
  utcDate: Date
): {
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
} => {
  // Get time components in 24-hour format directly
  const timeParts = PACIFIC_TIME_FORMATTER.formatToParts(utcDate);
  const weekdayParts = PACIFIC_WEEKDAY_FORMATTER.formatToParts(utcDate);

  // Extract components directly by index (formatToParts returns predictable order)
  const components = {
    hour: Number(timeParts[0]?.value) || 0,
    minute: Number(timeParts[2]?.value) || 0,
    second: Number(timeParts[4]?.value) || 0,
    dayOfWeek: 0,
  };

  // Handle weekday separately
  const weekdayPart = weekdayParts.find((p) => p.type === "weekday");
  if (weekdayPart?.value) {
    const weekdayIndex = [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ].indexOf(weekdayPart.value);
    components.dayOfWeek = weekdayIndex >= 0 ? weekdayIndex : 0;
  }

  return components;
};

/**
 * Get a Date object representing the same moment in Pacific timezone
 * This creates a Date with Pacific time components (stored as UTC)
 *
 * @param utcDate - UTC date to convert
 * @returns Date object (stored as UTC, but represents Pacific time values)
 */
export const getPacificTime = (utcDate: Date): Date => {
  const components = getPacificTimeComponents(utcDate);
  const year = utcDate.getUTCFullYear();
  const month = utcDate.getUTCMonth();
  const day = utcDate.getUTCDate();

  // Create a new Date with Pacific time components (stored as UTC)
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      components.hour,
      components.minute,
      components.second
    )
  );
};

/**
 * Get day of week for a UTC date in Pacific timezone
 *
 * @param utcDate - UTC date to convert
 * @returns Day of week (0-6, where 0 = Sunday)
 */
export const getPacificDayOfWeek = (utcDate: Date): number => {
  return getPacificTimeComponents(utcDate).dayOfWeek;
};

/**
 * Calculate the time delta in minutes between two dates
 *
 * @param startTime - Start date
 * @param endTime - End date
 * @returns Difference in minutes (can be negative if endTime < startTime)
 */
export const getMinutesDelta = (startTime: Date, endTime: Date): number =>
  (endTime.getTime() - startTime.getTime()) / (1000 * 60);

/**
 * Round an epoch-ms timestamp down to the nearest second.
 *
 * @param epochMs - Epoch timestamp in milliseconds
 * @returns Timestamp floored to whole seconds
 */
export const floorToSecond = (epochMs: number): number =>
  Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND;

/**
 * Calculate the difference between two epoch-ms timestamps in minutes rounded
 * to one decimal place.
 *
 * @param startMs - Start timestamp in milliseconds
 * @param endMs - End timestamp in milliseconds
 * @returns Difference in minutes rounded to 0.1
 */
export const getRoundedMinutesDelta = (
  startMs: number,
  endMs: number
): number => Math.round(((endMs - startMs) / MS_PER_MINUTE) * 10) / 10;

/**
 * Get the sailing day date for a UTC timestamp in Pacific timezone
 * Sailing day is defined as the period from 3:00 AM to 2:59 AM Pacific time
 * Events before 3:00 AM Pacific are considered part of the previous day's sailing day
 *
 * @param utcDate - UTC timestamp to convert
 * @returns Sailing day date string in YYYY-MM-DD format
 */
export const getSailingDay = (utcDate: Date): string => {
  const components = getPacificTimeComponents(utcDate);

  // Create a Date object for the Pacific date
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const pacificDateStr = formatter.format(utcDate);

  // If the time is before 3:00 AM Pacific, it's part of the previous day's sailing day
  if (components.hour < 3) {
    // Parse the Pacific date and subtract one day from a UTC anchor so the
    // result is independent of the machine's local timezone.
    const [year, month, day] = pacificDateStr.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
    date.setUTCDate(date.getUTCDate() - 1);

    return formatter.format(date);
  }

  return pacificDateStr;
};

/**
 * Shift a Pacific sailing calendar day string (`YYYY-MM-DD`) by a whole number
 * of calendar days. Uses noon UTC anchors so DST boundaries do not flip the
 * formatted Pacific date unexpectedly.
 *
 * @param ymd - Date string in `YYYY-MM-DD` form (e.g. from {@link getSailingDay})
 * @param deltaDays - Whole days to add (negative to subtract)
 */
export const addDaysToYyyyMmDd = (ymd: string, deltaDays: number): string => {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(anchor);
};
