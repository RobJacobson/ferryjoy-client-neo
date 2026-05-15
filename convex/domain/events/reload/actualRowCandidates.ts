/**
 * Shared actual-row candidate helpers for reload sources.
 *
 * History, trip-field, and tracking sources all materialize through the same
 * row-candidate shape before precedence is applied in actual-row assembly.
 */

import type {
  ActualRowCandidate,
  ReloadTripWithTripKey,
  ScheduledBoundary,
} from "./types";

/**
 * Builds an actual row candidate from a scheduled boundary and TripKey.
 *
 * @param boundary - Scheduled boundary matched by the source
 * @param tripKey - Physical TripKey joined to the boundary segment
 * @param actualTime - Observed boundary time when known
 * @param requireActualTime - Whether this source needs a timestamp to emit a row
 * @returns Actual row candidate or undefined when required values are absent
 */
const toBoundaryActualRowCandidate = (
  boundary: ScheduledBoundary,
  tripKey: string | undefined,
  actualTime: number | undefined,
  requireActualTime = false
): ActualRowCandidate | undefined =>
  tripKey === undefined || (requireActualTime && actualTime === undefined)
    ? undefined
    : {
        tripKey,
        vesselAbbrev: boundary.VesselAbbrev,
        sailingDay: boundary.SailingDay,
        scheduledDeparture: boundary.ScheduledDeparture,
        terminalAbbrev: boundary.TerminalAbbrev,
        eventType: boundary.EventType,
        actualTime,
      };

/**
 * Builds an actual row candidate from a physical-only trip and observed boundary.
 *
 * @param trip - Physical-only trip carrying TripKey
 * @param terminalAbbrev - Boundary terminal abbrev
 * @param eventType - Dock boundary type
 * @param actualTime - Observed boundary time
 * @returns Actual row candidate anchored by scheduled departure or actual time
 */
const toTripActualRowCandidate = (
  trip: ReloadTripWithTripKey,
  terminalAbbrev: string,
  eventType: ActualRowCandidate["eventType"],
  actualTime: number
): ActualRowCandidate => ({
  tripKey: trip.TripKey,
  vesselAbbrev: trip.VesselAbbrev,
  sailingDay: trip.SailingDay,
  scheduledDeparture: trip.ScheduledDeparture ?? actualTime,
  terminalAbbrev,
  eventType,
  actualTime,
});

/**
 * Returns whether a candidate value is defined.
 *
 * @param value - Optional projection result
 * @returns True when the value is present
 */
const isDefined = <TValue>(value: TValue | undefined): value is TValue =>
  value !== undefined;

export { isDefined, toBoundaryActualRowCandidate, toTripActualRowCandidate };
