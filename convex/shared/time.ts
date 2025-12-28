// ============================================================================
// SHARED TIME UTILITY FUNCTIONS
// Core time-related functions used across the application
// ============================================================================

// Timezone formatter for America/Los_Angeles (Pacific Time)
// Using Intl.DateTimeFormat ensures accurate DST handling for any year
const PACIFIC_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  weekday: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/**
 * Extract Pacific time components from a UTC date using Intl API
 * This properly handles DST transitions for any year without manual calculations
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
  // Format the date in Pacific timezone
  const parts = PACIFIC_TIME_FORMATTER.formatToParts(utcDate);

  // Extract components
  let hour = 0,
    minute = 0,
    second = 0,
    dayOfWeek = 0,
    dayPeriod = "";

  for (const part of parts) {
    switch (part.type) {
      case "hour":
        hour = Number.parseInt(part.value, 10);
        break;
      case "minute":
        minute = Number.parseInt(part.value, 10);
        break;
      case "second":
        second = Number.parseInt(part.value, 10);
        break;
      case "dayPeriod":
        dayPeriod = part.value;
        break;
      case "weekday": {
        // Map weekday names to numbers (Sunday = 0)
        const weekdayMap: Record<string, number> = {
          Sun: 0,
          Mon: 1,
          Tue: 2,
          Wed: 3,
          Thu: 4,
          Fri: 5,
          Sat: 6,
        };
        dayOfWeek = weekdayMap[part.value] ?? 0;
        break;
      }
    }
  }

  // Convert 12-hour format to 24-hour format
  if (dayPeriod === "PM" && hour !== 12) {
    hour += 12;
  } else if (dayPeriod === "AM" && hour === 12) {
    hour = 0;
  }

  return { hour, minute, second, dayOfWeek };
};

/**
 * Get a Date object representing the same moment in Pacific timezone
 * This creates a Date with Pacific time components (stored as UTC)
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
 * @param utcDate - UTC date to convert
 * @returns Day of week (0-6, where 0 = Sunday)
 */
export const getPacificDayOfWeek = (utcDate: Date): number => {
  return getPacificTimeComponents(utcDate).dayOfWeek;
};

/**
 * Calculate the time delta in minutes between two dates
 * @param startTime - Start date
 * @param endTime - End date
 * @returns Difference in minutes (can be negative if endTime < startTime)
 */
export const getMinutesDelta = (startTime: Date, endTime: Date): number =>
  (endTime.getTime() - startTime.getTime()) / (1000 * 60);
