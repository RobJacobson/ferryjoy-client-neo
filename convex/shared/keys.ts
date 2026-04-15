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
 * Builds the canonical **schedule segment** key (composite sailing identity).
 * For physical trip instance identity see `physicalTripIdentity.generateTripKey`.
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param departingTerminalAbbrev - Departing terminal abbreviation
 * @param arrivingTerminalAbbrev - Arriving terminal abbreviation
 * @param departingTime - Departure time as Date object
 * @returns Segment key string, or undefined if required fields are missing
 */
export const buildScheduleSegmentKey = (
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

/**
 * Groups rows by vessel and sailing day (matches `events*` table index scopes).
 * Inverse: {@link parseVesselSailingDayScopeKey}.
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Sailing day string (YYYY-MM-DD)
 * @returns Stable scope key; vessel abbrev must not contain `:`
 */
export const buildVesselSailingDayScopeKey = (
  vesselAbbrev: string,
  sailingDay: string
): string => `${vesselAbbrev}:${sailingDay}`;

/**
 * Splits a {@link buildVesselSailingDayScopeKey} string back into parts.
 *
 * @param scopeKey - String from {@link buildVesselSailingDayScopeKey}
 * @returns Vessel abbrev and sailing day
 */
export const parseVesselSailingDayScopeKey = (
  scopeKey: string
): { vesselAbbrev: string; sailingDay: string } => {
  const i = scopeKey.indexOf(":");
  if (i === -1) {
    throw new Error(`Invalid vessel/sailing-day scope key: ${scopeKey}`);
  }
  return {
    vesselAbbrev: scopeKey.slice(0, i),
    sailingDay: scopeKey.slice(i + 1),
  };
};

/**
 * Boundary keys for ML / predicted overlays: current segment dep + arv, next
 * leg departure. Used by trip hydration and `getPredictedBoundaryTargetKeys`.
 *
 * @param trip - Trip row with optional schedule alignment (`ScheduleKey`) and
 *   next schedule segment (`NextScheduleKey`)
 * @returns Dep-dock, arv-dock, and next dep-dock boundary keys
 */
export const buildTripPredictionBoundaryKeys = (trip: {
  ScheduleKey?: string;
  NextScheduleKey?: string;
}) => ({
  depDockKey: trip.ScheduleKey
    ? buildBoundaryKey(trip.ScheduleKey, "dep-dock")
    : undefined,
  arvDockKey: trip.ScheduleKey
    ? buildBoundaryKey(trip.ScheduleKey, "arv-dock")
    : undefined,
  nextDepDockKey: trip.NextScheduleKey
    ? buildBoundaryKey(trip.NextScheduleKey, "dep-dock")
    : undefined,
});
