/**
 * Materialize actual dock-event rows from ordered evidence.
 *
 * Actual evidence builders produce source-neutral evidence rows. This module
 * owns precedence, TripKey indexes, physical-only trip fields, and conversion
 * into the persisted eventsActual row shape.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import { groupBy } from "shared/groupBy";
import { buildActualDockEventFromWrite } from "../actual";
import { dedupeActualRowsByEventKey } from "../dedupeActualRows";
import type {
  ActualEvidence,
  ReloadTripInput,
  ReloadTripWithTripKey,
  ScheduledBoundary,
} from "./types";

/**
 * Builds actual rows from ordered evidence.
 *
 * @param evidence - Actual evidence ordered by source precedence
 * @param updatedAt - UpdatedAt timestamp for produced rows
 * @returns Deduped actual dock-event rows ready for persistence
 */
const buildActualRows = (
  evidence: ActualEvidence[],
  updatedAt: number
): ConvexActualDockEvent[] =>
  dedupeActualRowsByEventKey(
    [
      ...evidence
        .reduce(addEvidenceIfAbsent, new Map<string, ActualEvidence>())
        .values(),
    ].map((entry) =>
      buildActualDockEventFromWrite(
        {
          TripKey: entry.tripKey,
          VesselAbbrev: entry.vesselAbbrev,
          SailingDay: entry.sailingDay,
          ScheduledDeparture: entry.scheduledDeparture,
          TerminalAbbrev: entry.terminalAbbrev,
          EventType: entry.eventType,
          EventOccurred: true,
          EventActualTime: entry.actualTime,
        },
        updatedAt
      )
    )
  );

/**
 * Builds indexes shared by actual evidence projections.
 *
 * @param boundaries - Scheduled boundaries for the sailing day
 * @param tripsWithKeys - Active and completed trips that carry TripKey
 * @param activeTripsWithKeys - Active trips that carry TripKey
 * @returns Lookup maps and physical-only trip collections
 */
const buildActualIndexes = (
  boundaries: ScheduledBoundary[],
  tripsWithKeys: ReloadTripWithTripKey[],
  activeTripsWithKeys: ReloadTripWithTripKey[]
) => ({
  tripKeyBySegmentKey: new Map(
    tripsWithKeys.map((trip) => [
      trip.ScheduleKey ?? trip.TripKey,
      trip.TripKey,
    ])
  ),
  physicalOnlyTrips: tripsWithKeys.filter(isPhysicalOnlyTrip),
  activePhysicalOnlyTripsByVessel: new Map(
    activeTripsWithKeys
      .filter(isPhysicalOnlyTrip)
      .map((trip) => [trip.VesselAbbrev, trip])
  ),
  boundariesByVessel: groupBy(boundaries, (boundary) => boundary.VesselAbbrev),
});

/**
 * Builds actual evidence from durable physical-only trip fields.
 *
 * @param trips - Physical-only trips carrying TripKey
 * @returns Departure and arrival evidence from trip fields
 */
const buildTripFieldEvidence = (
  trips: ReloadTripWithTripKey[]
): ActualEvidence[] =>
  trips.flatMap((trip) =>
    [
      trip.LeftDockActual === undefined
        ? undefined
        : toTripEvidence(
            trip,
            trip.DepartingTerminalAbbrev,
            "dep-dock",
            trip.LeftDockActual,
            "trip"
          ),
      trip.TripEnd === undefined || trip.ArrivingTerminalAbbrev === undefined
        ? undefined
        : toTripEvidence(
            trip,
            trip.ArrivingTerminalAbbrev,
            "arv-dock",
            trip.TripEnd,
            "trip"
          ),
    ].filter(isDefined)
  );

/**
 * Builds the preserve set for physical-only actual replacement.
 *
 * @param trips - Active and completed trips that carry TripKey
 * @returns Physical-only TripKeys whose absent rows should be preserved
 */
const buildPreserveAbsentTripKeys = (
  trips: ReloadTripWithTripKey[]
): Set<string> =>
  new Set(trips.filter(isPhysicalOnlyTrip).map((trip) => trip.TripKey));

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
 * Narrows a trip to rows that carry TripKey.
 *
 * @param trip - Active or completed trip input
 * @returns Trip with required TripKey or undefined when missing
 */
const toTripWithKey = (
  trip: ReloadTripInput
): ReloadTripWithTripKey | undefined =>
  trip.TripKey === undefined ? undefined : { ...trip, TripKey: trip.TripKey };

/**
 * Adds evidence by TripKey and boundary only when no stronger source exists.
 *
 * @param evidenceByTripBoundary - Prior evidence map
 * @param evidence - Candidate evidence in source precedence order
 * @returns Evidence map with first-write-wins precedence
 */
const addEvidenceIfAbsent = (
  evidenceByTripBoundary: Map<string, ActualEvidence>,
  evidence: ActualEvidence
): Map<string, ActualEvidence> =>
  evidenceByTripBoundary.has(toTripBoundaryKey(evidence))
    ? evidenceByTripBoundary
    : new Map(evidenceByTripBoundary).set(
        toTripBoundaryKey(evidence),
        evidence
      );

/**
 * Returns whether a trip lacks schedule linkage.
 *
 * @param trip - Trip carrying TripKey
 * @returns True when the trip is physical-only
 */
const isPhysicalOnlyTrip = (trip: ReloadTripWithTripKey): boolean =>
  trip.ScheduleKey === undefined;

/**
 * Returns whether a candidate value is defined.
 *
 * @param value - Optional projection result
 * @returns True when the value is present
 */
const isDefined = <TValue>(value: TValue | undefined): value is TValue =>
  value !== undefined;

/**
 * Builds the composite TripKey and boundary type key.
 *
 * @param evidence - Actual evidence with TripKey and event type
 * @returns Composite TripKey/event-type key
 */
const toTripBoundaryKey = (
  evidence: Pick<ActualEvidence, "tripKey" | "eventType">
) => `${evidence.tripKey}|${evidence.eventType}`;

export {
  buildActualIndexes,
  buildActualRows,
  buildPreserveAbsentTripKeys,
  buildTripFieldEvidence,
  isDefined,
  toBoundaryEvidence,
  toTripEvidence,
  toTripWithKey,
};
