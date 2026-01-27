/**
 * Schedule trip key generation.
 *
 * This is a client-safe copy of the Convex `shared/keys.ts` implementation.
 * We keep it in `src/` so the frontend does not import server/Convex modules.
 */

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Format a UTC date as Pacific local date (YYYY-MM-DD).
 *
 * @param utcDate - UTC date to format
 * @returns Date string in Pacific timezone (YYYY-MM-DD)
 */
export const formatPacificDate = (utcDate: Date): string => {
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
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return formatter.format(utcDate);
};

/**
 * Generate composite key for any trip type.
 * Format: "[vessel]--[pacific_date]--[pacific_time]--[departing]-[arriving]".
 *
 * Note: the date/time are Pacific *calendar* date/time derived from the provided
 * UTC `Date` object (not WSF sailing day logic).
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param departingTerminalAbbrev - Departing terminal abbreviation
 * @param arrivingTerminalAbbrev - Arriving terminal abbreviation (optional)
 * @param departingTime - Departure time as Date object
 * @returns Composite key string, or undefined if required fields are missing
 */
export const generateTripKey = (
  vesselAbbrev: string,
  departingTerminalAbbrev: string,
  arrivingTerminalAbbrev: string | undefined,
  departingTime: Date | undefined
): string | undefined => {
  if (!departingTime || !vesselAbbrev || !departingTerminalAbbrev) {
    return undefined;
  }

  const arrivingAbbrev = arrivingTerminalAbbrev || "";
  const dateStr = formatPacificDate(departingTime);
  const timeStr = formatPacificTime(departingTime);
  return `${vesselAbbrev}--${dateStr}--${timeStr}--${departingTerminalAbbrev}-${arrivingAbbrev}`;
};

