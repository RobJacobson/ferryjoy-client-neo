/**
 * Build actual dock-event rows from reload row-candidate sources.
 *
 * Actual-row assembly owns TripKey indexes, source precedence, and
 * conversion into the persisted eventsActual row shape. Callers pass raw reload
 * inputs and do not need to understand candidate ordering.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { groupBy } from "shared/groupBy";
import { buildActualDockEventFromWrite } from "../actual";
import { isDefined, toTripActualRowCandidate } from "./actualRowCandidates";
import { buildHistoryActualRowCandidates } from "./buildHistoryActualRowCandidates";
import {
  buildPhysicalOnlyTrackingActualRowCandidates,
  buildScheduleAlignedTrackingActualRowCandidates,
  trackingLocationMatchesSailingDay,
} from "./buildTrackingActualRowCandidates";
import type { WsfVesselHistory } from "./schemas";
import type {
  ActualRowCandidate,
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

type ActualRowCandidateAccumulator = ReadonlyMap<string, ActualRowCandidate>;

/**
 * Builds actual dock rows from raw reload inputs.
 *
 * Source precedence is explicit in the accumulator pipeline: WSF history wins
 * first, durable trip fields second, scheduled tracking third, and physical-only
 * tracking last.
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

  const historyCandidates = buildHistoryActualRowCandidates({
    seedLegs,
    boundaries,
    historyRecords,
    tripKeyBySegmentKey: indexes.tripKeyBySegmentKey,
    vessels,
    terminals,
  });
  const tripFieldCandidates = buildTripFieldActualRowCandidates(
    indexes.physicalOnlyTrips
  );
  const trackingCandidates = buildScheduleAlignedTrackingActualRowCandidates(
    locations,
    indexes.boundariesByVessel,
    indexes.tripKeyBySegmentKey
  );
  const physicalOnlyTrackingCandidates =
    buildPhysicalOnlyTrackingActualRowCandidates(
      locations,
      indexes.activePhysicalOnlyTripsByVessel
    );
  const orderedCandidates = [
    ...historyCandidates,
    ...tripFieldCandidates,
    ...trackingCandidates,
    ...physicalOnlyTrackingCandidates,
  ];
  const candidatesByTripBoundary = orderedCandidates.reduce(
    addActualRowCandidateIfAbsent,
    new Map<string, ActualRowCandidate>()
  );
  const actualRows = materializeActualRows(candidatesByTripBoundary, updatedAt);

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
 * Builds actual rows from accumulated row candidates.
 *
 * @param candidatesByTripBoundary - Winning candidate per TripKey and event type
 * @param updatedAt - UpdatedAt timestamp for produced rows
 * @returns Actual dock-event rows ready for persistence
 */
const materializeActualRows = (
  candidatesByTripBoundary: ActualRowCandidateAccumulator,
  updatedAt: number
): ConvexActualDockEvent[] =>
  [...candidatesByTripBoundary.values()].map((candidate) =>
    buildActualDockEventFromWrite(
      {
        TripKey: candidate.tripKey,
        VesselAbbrev: candidate.vesselAbbrev,
        SailingDay: candidate.sailingDay,
        ScheduledDeparture: candidate.scheduledDeparture,
        TerminalAbbrev: candidate.terminalAbbrev,
        EventType: candidate.eventType,
        EventOccurred: true,
        EventActualTime: candidate.actualTime,
      },
      updatedAt
    )
  );

/**
 * Builds indexes shared by actual row candidate projections.
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
 * Builds actual row candidates from durable physical-only trip fields.
 *
 * @param trips - Physical-only trips carrying TripKey
 * @returns Departure and arrival candidates from trip fields
 */
const buildTripFieldActualRowCandidates = (
  trips: ReloadTripWithTripKey[]
): ActualRowCandidate[] =>
  trips.flatMap((trip) =>
    [
      trip.LeftDockActual === undefined
        ? undefined
        : toTripActualRowCandidate(
            trip,
            trip.DepartingTerminalAbbrev,
            "dep-dock",
            trip.LeftDockActual
          ),
      trip.TripEnd === undefined || trip.ArrivingTerminalAbbrev === undefined
        ? undefined
        : toTripActualRowCandidate(
            trip,
            trip.ArrivingTerminalAbbrev,
            "arv-dock",
            trip.TripEnd
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
 * Adds one candidate by TripKey and boundary only when absent.
 *
 * @param candidatesByTripBoundary - Prior candidate accumulator
 * @param candidate - Candidate from the next source in precedence order
 * @returns Candidate accumulator with first-write-wins precedence
 */
const addActualRowCandidateIfAbsent = (
  candidatesByTripBoundary: ActualRowCandidateAccumulator,
  candidate: ActualRowCandidate
): ActualRowCandidateAccumulator =>
  candidatesByTripBoundary.has(toTripBoundaryKey(candidate))
    ? candidatesByTripBoundary
    : new Map(candidatesByTripBoundary).set(
        toTripBoundaryKey(candidate),
        candidate
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
 * @param candidate - Actual row candidate with TripKey and event type
 * @returns Composite TripKey/event-type key
 */
const toTripBoundaryKey = (
  candidate: Pick<ActualRowCandidate, "tripKey" | "eventType">
) => `${candidate.tripKey}|${candidate.eventType}`;

export { buildActualRows, buildPreserveAbsentTripKeys };
