/**
 * Sailing day calculation utilities for WSF (Washington State Ferries)
 *
 * WSF uses a "sailing day" concept that runs from 3:00 AM to 2:59 AM Pacific time.
 * This is different from a calendar day and is used for trip date calculations.
 */

/**
 * Get the sailing day date for a UTC timestamp in Pacific timezone.
 * Sailing day is defined as the period from 3:00 AM to 2:59 AM Pacific time.
 * Events before 3:00 AM Pacific are considered part of the previous day's sailing day.
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
    // Parse the date string and subtract one day
    const [year, month, day] = pacificDateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    date.setDate(date.getDate() - 1);

    return formatter.format(date);
  }

  return pacificDateStr;
};
/**
 * Extract Pacific time components from a UTC date using Intl API.
 * This properly handles DST transitions for any year without manual calculations.
 *
 * @param utcDate - UTC date to convert
 * @returns Object with hour, minute, second, and day of week in Pacific time
 */
const getPacificTimeComponents = (
  utcDate: Date
): {
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
} => {
  const PACIFIC_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  const PACIFIC_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
  });

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
