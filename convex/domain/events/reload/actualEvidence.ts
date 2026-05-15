/**
 * Shared actual-evidence helpers for reload sources.
 *
 * History, trip-field, and tracking evidence all materialize through the same
 * source-neutral shape before precedence is applied in actual-row assembly.
 */

import type {
  ActualEvidence,
  ReloadTripWithTripKey,
  ScheduledBoundary,
} from "./types";

/**
 * Builds evidence from a scheduled boundary and TripKey.
 *
 * @param boundary - Scheduled boundary matched by evidence
 * @param tripKey - Physical TripKey joined to the boundary segment
 * @param actualTime - Observed boundary time when known
 * @param source - Evidence source label for precedence and debugging
 * @returns Actual evidence or undefined when required values are absent
 */
const toBoundaryEvidence = (
  boundary: ScheduledBoundary,
  tripKey: string | undefined,
  actualTime: number | undefined,
  source: ActualEvidence["source"]
): ActualEvidence | undefined =>
  tripKey === undefined || (source === "history" && actualTime === undefined)
    ? undefined
    : {
        tripKey,
        vesselAbbrev: boundary.VesselAbbrev,
        sailingDay: boundary.SailingDay,
        scheduledDeparture: boundary.ScheduledDeparture,
        terminalAbbrev: boundary.TerminalAbbrev,
        eventType: boundary.EventType,
        actualTime,
        source,
      };

/**
 * Builds evidence from a physical-only trip and observed boundary.
 *
 * @param trip - Physical-only trip carrying TripKey
 * @param terminalAbbrev - Boundary terminal abbrev
 * @param eventType - Dock boundary type
 * @param actualTime - Observed boundary time
 * @param source - Evidence source label for precedence and debugging
 * @returns Actual evidence anchored by scheduled departure or actual time
 */
const toTripEvidence = (
  trip: ReloadTripWithTripKey,
  terminalAbbrev: string,
  eventType: ActualEvidence["eventType"],
  actualTime: number,
  source: ActualEvidence["source"]
): ActualEvidence => ({
  tripKey: trip.TripKey,
  vesselAbbrev: trip.VesselAbbrev,
  sailingDay: trip.SailingDay,
  scheduledDeparture: trip.ScheduledDeparture ?? actualTime,
  terminalAbbrev,
  eventType,
  actualTime,
  source,
});

/**
 * Returns whether a candidate value is defined.
 *
 * @param value - Optional projection result
 * @returns True when the value is present
 */
const isDefined = <TValue>(value: TValue | undefined): value is TValue =>
  value !== undefined;

export { isDefined, toBoundaryEvidence, toTripEvidence };
