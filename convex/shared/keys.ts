/**
 * Shared key generation utilities for trips and other entities
 * Provides consistent key generation across different trip types
 */

export type BoundaryEventType = "dep-dock" | "arv-dock";

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
 * Generate the canonical segment key shared by scheduled trips, vessel trips,
 * and timeline boundary events.
 * Format: "[vessel]--[sailing day]--[time]--[departing terminal]-[arriving terminal]"
 * Uses Pacific calendar day (not WSF sailing day logic).
 * Time is in HH:MM format (Pacific timezone)
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param departingTerminalAbbrev - Departing terminal abbreviation
 * @param arrivingTerminalAbbrev - Arriving terminal abbreviation (can be empty string or undefined)
 * @param departingTime - Departure time as Date object
 * @returns Segment key string, or undefined if required fields are missing
 */
export const buildSegmentKey = (
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

/**
 * Backwards-compatible alias for the canonical segment key helper.
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param departingTerminalAbbrev - Departing terminal abbreviation
 * @param arrivingTerminalAbbrev - Arriving terminal abbreviation
 * @param departingTime - Departure time as Date object
 * @returns Segment key string, or undefined if required fields are missing
 */
export const generateTripKey = (
  vesselAbbrev: string,
  departingTerminalAbbrev: string,
  arrivingTerminalAbbrev: string | undefined,
  departingTime: Date | undefined
) =>
  buildSegmentKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    departingTime
  );

/**
 * Generate a boundary-event key from the canonical segment key.
 *
 * @param segmentKey - Canonical segment key for the sailing
 * @param eventType - Boundary event type for the segment
 * @returns Stable boundary-event key
 */
export const buildBoundaryKey = (
  segmentKey: string,
  eventType: BoundaryEventType
) => `${segmentKey}--${eventType}`;
