/**
 * Shared key generation utilities for trips and other entities
 * Provides consistent key generation across different trip types
 */

/**
 * Format a UTC date as Pacific local date (YYYY-MM-DD)
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
 * Generate composite key for any trip type
 * Format: "[vessel]-[date]-[departing terminal]-[arriving terminal]"
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
  if (!departingTime) {
    return undefined;
  }

  const arrivingAbbrev = arrivingTerminalAbbrev || "";
  const dateStr = formatPacificDate(departingTime);
  return `${vesselAbbrev}-${dateStr}-${departingTerminalAbbrev}-${arrivingAbbrev}`;
};
