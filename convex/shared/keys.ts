/**
 * Shared key generation utilities for trips and other entities
 * Provides consistent key generation across different trip types
 */

/**
 * Format a UTC date as Pacific local date (YYYY-MM-DD).
 *
 * @param utcDate - UTC date to format
 * @returns Date string in Pacific timezone (YYYY-MM-DD)
 */
export const formatPacificDate = (utcDate: Date): string => {
  // Use Intl.DateTimeFormat to get Pacific date components
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(utcDate);
};

/**
 * Format a UTC time as Pacific local time (HH:MM).
 *
 * @param utcDate - UTC date to format
 * @returns Time string in Pacific timezone (HH:MM)
 */
export const formatPacificTime = (utcDate: Date): string => {
  // Use Intl.DateTimeFormat to get Pacific time components
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return formatter.format(utcDate);
};

/**
 * Generate composite key for any trip type
 * Format: "[vessel]--[sailing day]--[time]--[departing terminal]-[arriving terminal]"
 * Uses Pacific calendar day (not WSF sailing day logic).
 * Time is in HH:MM format (Pacific timezone)
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param departingTerminalAbbrev - Departing terminal abbreviation
 * @param arrivingTerminalAbbrev - Arriving terminal abbreviation (can be empty string or undefined)
 * @param departingTime - Departure time as Date object
 * @returns Composite key string, or undefined if required fields are missing
 */
export const generateTripKey = (
  vesselAbbrev: string,
  departingTerminalAbbrev: string,
  arrivingTerminalAbbrev: string | undefined,
  departingTime: Date | undefined
): string | undefined => {
  // Require minimum fields for key generation
  if (
    !departingTime ||
    !vesselAbbrev ||
    !departingTerminalAbbrev ||
    !arrivingTerminalAbbrev
  ) {
    return undefined;
  }

  const dateStr = formatPacificDate(departingTime);
  const timeStr = formatPacificTime(departingTime);
  return `${vesselAbbrev}--${dateStr}--${timeStr}--${departingTerminalAbbrev}-${arrivingTerminalAbbrev}`;
};
