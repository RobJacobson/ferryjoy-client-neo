/**
 * Build actual dock-event rows from reload evidence sources.
 *
 * Actual-row assembly owns TripKey indexes, evidence-source precedence, and
 * conversion into the persisted eventsActual row shape. Callers pass raw reload
 * inputs and do not need to understand evidence ordering.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { groupBy } from "shared/groupBy";
import { buildActualDockEventFromWrite } from "../actual";
import { dedupeActualRowsByEventKey } from "../dedupeActualRows";
import { isDefined, toTripEvidence } from "./actualEvidence";
import { buildHistoryEvidence } from "./buildHistoryEvidence";
import {
  buildPhysicalOnlyTrackingEvidence,
  buildScheduleAlignedTrackingEvidence,
  trackingLocationMatchesSailingDay,
} from "./buildTrackingEvidence";
import type { WsfVesselHistory } from "./schemas";
import type {
  ActualEvidence,
  ReloadTripInput,
  ReloadTripWithTripKey,
  ScheduledBoundary,
  SeedLeg,
} from "./types";

type BuildActualRowsArgs = {
  sailingDay: string;
  seedLegs: SeedLeg[];
  boundaries: ScheduledBoundary[];
  historyRecords: WsfVesselHistory[];
  activeTrips: ReloadTripInput[];
  completedTrips: ReloadTripInput[];
  vesselLocations: ConvexVesselLocation[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  updatedAt: number;
};

/**
 * Builds actual dock rows from raw reload inputs.
 *
 * Evidence source precedence is explicit through named arrays: WSF history
 * evidence wins first, durable trip fields second, scheduled tracking third,
 * and physical-only tracking last.
 *
 * @param args - Reload schedule, history, trip, tracking, identity, and timestamp inputs
 * @returns Deduped actual dock-event rows ready for persistence
 */
const buildActualRows = ({
  sailingDay,
  seedLegs,
  boundaries,
  historyRecords,
  activeTrips,
  completedTrips,
  vesselLocations,
  vessels,
  terminals,
  updatedAt,
}: BuildActualRowsArgs): ConvexActualDockEvent[] => {
  const tripsWithKeys = [...activeTrips, ...completedTrips]
    .map(toTripWithKey)
    .filter(isDefined);
  const activeTripsWithKeys = activeTrips.map(toTripWithKey).filter(isDefined);
  const indexes = buildActualIndexes(
    boundaries,
    tripsWithKeys,
    activeTripsWithKeys
  );
  const locations = vesselLocations.filter((location) =>
    trackingLocationMatchesSailingDay(location, sailingDay)
  );
  const historyEvidence = buildHistoryEvidence({
    seedLegs,
    boundaries,
    historyRecords,
    tripKeyBySegmentKey: indexes.tripKeyBySegmentKey,
    vessels,
    terminals,
  });
  const tripFieldEvidence = buildTripFieldEvidence(indexes.physicalOnlyTrips);
  const scheduledTrackingEvidence = buildScheduleAlignedTrackingEvidence(
    locations,
    indexes.boundariesByVessel,
    indexes.tripKeyBySegmentKey
  );
  const physicalOnlyTrackingEvidence = buildPhysicalOnlyTrackingEvidence(
    locations,
    indexes.activePhysicalOnlyTripsByVessel
  );
  const orderedEvidence = historyEvidence.concat(
    tripFieldEvidence,
    scheduledTrackingEvidence,
    physicalOnlyTrackingEvidence
  );
  const actualRows = materializeActualRows(orderedEvidence, updatedAt);

  return actualRows;
};

/**
 * Builds the preserve set for physical-only actual replacement.
 *
 * @param activeTrips - Active trip rows that may include physical-only TripKeys
 * @param completedTrips - Completed trip rows that may include physical-only TripKeys
 * @returns Physical-only TripKeys whose absent rows should be preserved
 */
const buildPreserveAbsentTripKeys = (
  activeTrips: ReloadTripInput[],
  completedTrips: ReloadTripInput[]
): Set<string> => {
  const tripsWithKeys = [...activeTrips, ...completedTrips]
    .map(toTripWithKey)
    .filter(isDefined);
  const preserveAbsentTripKeys = new Set(
    tripsWithKeys.filter(isPhysicalOnlyTrip).map((trip) => trip.TripKey)
  );

  return preserveAbsentTripKeys;
};

/**
 * Builds actual rows from ordered evidence.
 *
 * @param evidence - Actual evidence ordered by source precedence
 * @param updatedAt - UpdatedAt timestamp for produced rows
 * @returns Deduped actual dock-event rows ready for persistence
 */
const materializeActualRows = (
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
 * Builds the composite TripKey and boundary type key.
 *
 * @param evidence - Actual evidence with TripKey and event type
 * @returns Composite TripKey/event-type key
 */
const toTripBoundaryKey = (
  evidence: Pick<ActualEvidence, "tripKey" | "eventType">
) => `${evidence.tripKey}|${evidence.eventType}`;

export { buildActualRows, buildPreserveAbsentTripKeys };
