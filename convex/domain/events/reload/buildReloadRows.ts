/**
 * Build scheduled and actual dock-event rows for a reload sailing day.
 *
 * The reload transform keeps the data flow direct: schedule inputs become seed
 * legs, seed legs become scheduled boundaries, and durable plus tracking
 * evidence becomes actual rows with clear source precedence.
 */

import {
  resolveVesselHistory,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { buildActualDockEventFromWrite } from "../actual";
import { dedupeActualRowsByEventKey } from "../dedupeActualRows";
import { buildScheduledBoundaries } from "./buildScheduledBoundaries";
import { resolveSeedLegs } from "./resolveSeedLegs";
import type { WsfVesselHistory } from "./schemas";
import type {
  ActualEvidence,
  BuildReloadRowsArgs,
  BuildReloadRowsResult,
  ReloadTripInput,
  ReloadTripWithTripKey,
  ScheduledBoundary,
  SeedLeg,
} from "./types";

type HistorySeedLookup = {
  segmentKeys: Set<string>;
  segmentKeyByVesselDeparture: Map<string, string>;
};

/**
 * Builds scheduled rows, actual rows, and physical-only preserve keys.
 *
 * The function is the public domain entry point for the reload mutation. It
 * applies source precedence by reducing evidence in order: WSF history first,
 * durable trip fields second, current tracking last. Existing physical-only
 * TripKeys are returned with the rows so replacement persistence can preserve
 * absent physical-only actuals.
 *
 * @param args - Reload inputs from WSF, Convex trips, current locations, identity tables, and updatedAt
 * @returns Scheduled rows, actual rows, and physical-only TripKeys to preserve
 */
const buildReloadRows = ({
  sailingDay,
  scheduleSegments,
  historyRecords,
  activeTrips,
  completedTrips,
  vesselLocations,
  vessels,
  terminals,
  updatedAt,
}: BuildReloadRowsArgs): BuildReloadRowsResult => {
  const seedLegs = resolveSeedLegs(scheduleSegments, vessels, terminals);
  const boundaries = buildScheduledBoundaries(seedLegs);
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
  const evidence = [
    ...buildHistoryEvidence({
      seedLegs,
      boundaries,
      historyRecords,
      tripKeyBySegmentKey: indexes.tripKeyBySegmentKey,
      vessels,
      terminals,
    }),
    ...buildTripFieldEvidence(indexes.physicalOnlyTrips),
    ...buildScheduleAlignedTrackingEvidence(
      locations,
      indexes.boundariesByVessel,
      indexes.tripKeyBySegmentKey
    ),
    ...buildPhysicalOnlyTrackingEvidence(
      locations,
      indexes.activePhysicalOnlyTripsByVessel
    ),
  ];
  const scheduledRows = buildScheduledRows(boundaries, updatedAt);
  const actualRows = buildActualRows(evidence, updatedAt);
  const preserveAbsentTripKeys = buildPreserveAbsentTripKeys(tripsWithKeys);
  const reloadRows = {
    scheduledRows,
    actualRows,
    preserveAbsentTripKeys,
  };

  return reloadRows;
};

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
 * Projects scheduled boundaries into eventsScheduled rows.
 *
 * @param boundaries - Scheduled boundaries for the sailing day
 * @param updatedAt - UpdatedAt timestamp for produced rows
 * @returns Scheduled dock-event rows ready for persistence
 */
const buildScheduledRows = (
  boundaries: ScheduledBoundary[],
  updatedAt: number
): ConvexScheduledDockEvent[] => {
  const lastArrivalKeys = findLastArrivalKeysByVesselDay(boundaries);
  const scheduledRows = boundaries.map((boundary) => ({
    Key: boundary.Key,
    VesselAbbrev: boundary.VesselAbbrev,
    SailingDay: boundary.SailingDay,
    UpdatedAt: updatedAt,
    ScheduledDeparture: boundary.ScheduledDeparture,
    TerminalAbbrev: boundary.TerminalAbbrev,
    NextTerminalAbbrev: boundary.NextTerminalAbbrev,
    EventType: boundary.EventType,
    EventScheduledTime: boundary.EventScheduledTime,
    IsLastArrivalOfSailingDay:
      boundary.EventType === "arv-dock" && lastArrivalKeys.has(boundary.Key),
  }));

  return scheduledRows;
};

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
 * Builds actual evidence from WSF history records.
 *
 * @param options - Seed legs, scheduled boundaries, history rows, TripKey lookup, and identity tables
 * @returns Durable history evidence joined to TripKeys
 */
const buildHistoryEvidence = ({
  seedLegs,
  boundaries,
  historyRecords,
  tripKeyBySegmentKey,
  vessels,
  terminals,
}: {
  seedLegs: SeedLeg[];
  boundaries: ScheduledBoundary[];
  historyRecords: WsfVesselHistory[];
  tripKeyBySegmentKey: Map<string, string>;
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): ActualEvidence[] => {
  const actualTimeByBoundaryKey = mapHistoryActualsToBoundaryKeys(
    seedLegs,
    historyRecords,
    vessels,
    terminals
  );
  const historyEvidence = boundaries
    .map((boundary) =>
      toBoundaryEvidence(
        boundary,
        tripKeyBySegmentKey.get(boundary.SegmentKey),
        actualTimeByBoundaryKey.get(boundary.Key),
        "history"
      )
    )
    .filter(isDefined);

  return historyEvidence;
};

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
 * Builds actual evidence from tracking rows aligned to scheduled boundaries.
 *
 * @param locations - Current tracking rows scoped to the reload sailing day
 * @param boundariesByVessel - Scheduled boundaries grouped by vessel abbrev
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @returns Tracking evidence for scheduled TripKeys
 */
const buildScheduleAlignedTrackingEvidence = (
  locations: ConvexVesselLocation[],
  boundariesByVessel: Map<string, ScheduledBoundary[]>,
  tripKeyBySegmentKey: Map<string, string>
): ActualEvidence[] =>
  locations.flatMap((location) =>
    buildTrackingEvidenceForScheduledBoundaries(
      location,
      boundariesByVessel.get(location.VesselAbbrev) ?? [],
      tripKeyBySegmentKey
    )
  );

/**
 * Builds actual evidence from tracking rows for active physical-only trips.
 *
 * @param locations - Current tracking rows scoped to the reload sailing day
 * @param activePhysicalOnlyTripsByVessel - Active physical-only trips keyed by vessel
 * @returns Tracking evidence for physical-only TripKeys
 */
const buildPhysicalOnlyTrackingEvidence = (
  locations: ConvexVesselLocation[],
  activePhysicalOnlyTripsByVessel: Map<string, ReloadTripWithTripKey>
): ActualEvidence[] =>
  locations.flatMap((location) => {
    const trip = activePhysicalOnlyTripsByVessel.get(location.VesselAbbrev);
    const trackingEvidence =
      location.InService !== true || trip === undefined
        ? []
        : [
            location.AtDock === false
              ? toTripEvidence(
                  trip,
                  trip.DepartingTerminalAbbrev,
                  "dep-dock",
                  location.LeftDock ?? location.TimeStamp,
                  "tracking"
                )
              : undefined,
            location.AtDock === true &&
            trip.ArrivingTerminalAbbrev !== undefined
              ? toTripEvidence(
                  trip,
                  trip.ArrivingTerminalAbbrev,
                  "arv-dock",
                  location.TimeStamp,
                  "tracking"
                )
              : undefined,
          ].filter(isDefined);

    return trackingEvidence;
  });

/**
 * Builds schedule-aligned tracking evidence for one location row.
 *
 * @param location - Current tracking row
 * @param boundaries - Same-vessel scheduled boundaries
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @returns Zero or more scheduled tracking evidence rows
 */
const buildTrackingEvidenceForScheduledBoundaries = (
  location: ConvexVesselLocation,
  boundaries: ScheduledBoundary[],
  tripKeyBySegmentKey: Map<string, string>
): ActualEvidence[] => {
  const departureBoundary = getTrackingAnchoredBoundary(
    boundaries,
    location,
    "dep-dock"
  );
  const arrivalBoundary = findArrivalBoundaryForTracking(
    boundaries,
    location,
    departureBoundary
  );
  const trackingEvidence =
    boundaries.length === 0 || location.InService !== true
      ? []
      : [
          toTrackingBoundaryEvidence(
            departureBoundary,
            location,
            tripKeyBySegmentKey,
            location.LeftDock
          ),
          toTrackingBoundaryEvidence(
            arrivalBoundary,
            location,
            tripKeyBySegmentKey,
            undefined
          ),
        ].filter(isDefined);

  return trackingEvidence;
};

/**
 * Builds one scheduled tracking evidence row when tracking state supports it.
 *
 * @param boundary - Matched scheduled boundary
 * @param location - Current tracking row
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @param actualTime - Observed boundary time when known
 * @returns Actual evidence or undefined when guards fail
 */
const toTrackingBoundaryEvidence = (
  boundary: ScheduledBoundary | undefined,
  location: ConvexVesselLocation,
  tripKeyBySegmentKey: Map<string, string>,
  actualTime: number | undefined
): ActualEvidence | undefined => {
  const tripKey =
    boundary === undefined
      ? undefined
      : tripKeyBySegmentKey.get(boundary.SegmentKey);
  const trackingEvidence =
    boundary === undefined ||
    tripKey === undefined ||
    !trackingStateSupportsBoundary(location, boundary)
      ? undefined
      : toBoundaryEvidence(boundary, tripKey, actualTime, "tracking");

  return trackingEvidence;
};

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
 * Indexes WSF history actual times by scheduled boundary key.
 *
 * @param seedLegs - Direct seed legs in scope for this reload
 * @param historyRecords - WSF vessel history rows
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Actual times keyed by scheduled boundary key
 */
const mapHistoryActualsToBoundaryKeys = (
  seedLegs: SeedLeg[],
  historyRecords: WsfVesselHistory[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): Map<string, number> => {
  const seedLookup = buildHistorySeedLookup(seedLegs);
  const historyActualEntries = historyRecords.flatMap((record) =>
    historyRecordToBoundaryEntries(record, seedLookup, vessels, terminals)
  );
  const actualTimeByBoundaryKey = new Map(historyActualEntries);

  return actualTimeByBoundaryKey;
};

/**
 * Converts one history row to boundary-key actual time entries.
 *
 * @param record - WSF vessel history row
 * @param seedLookup - Seed-leg indexes for strict and recovery matching
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Boundary-key entries for present actual timestamps
 */
const historyRecordToBoundaryEntries = (
  record: WsfVesselHistory,
  seedLookup: HistorySeedLookup,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): Array<[string, number]> => {
  const segmentKey = canUseHistoryRecord(record)
    ? resolveHistorySegmentKey(record, seedLookup, vessels, terminals)
    : undefined;
  const historyEntries =
    segmentKey === undefined
      ? []
      : [
          toHistoryBoundaryEntry(segmentKey, "dep-dock", record.ActualDepart),
          toHistoryBoundaryEntry(segmentKey, "arv-dock", record.EstArrival),
        ].filter(isDefined);

  return historyEntries;
};

/**
 * Builds one history actual entry when the timestamp is present.
 *
 * @param segmentKey - Resolved seed-leg segment key
 * @param eventType - Dock boundary type
 * @param actualTime - Observed boundary time
 * @returns Boundary-key entry or undefined when the timestamp is absent
 */
const toHistoryBoundaryEntry = (
  segmentKey: string,
  eventType: ActualEvidence["eventType"],
  actualTime: number | undefined
): [string, number] | undefined =>
  actualTime === undefined
    ? undefined
    : [buildBoundaryKey(segmentKey, eventType), actualTime];

/**
 * Builds seed-leg indexes for history matching.
 *
 * @param seedLegs - Direct seed legs in scope for this reload
 * @returns Segment-key set plus vessel/departure recovery index
 */
const buildHistorySeedLookup = (seedLegs: SeedLeg[]): HistorySeedLookup => ({
  segmentKeys: new Set(seedLegs.map((leg) => leg.Key)),
  segmentKeyByVesselDeparture: new Map(
    seedLegs.map((leg) => [
      toVesselDepartureKey(leg.VesselAbbrev, leg.DepartingTime),
      leg.Key,
    ])
  ),
});

/**
 * Resolves the seed-leg key for one history row.
 *
 * @param record - WSF vessel history row
 * @param seedLookup - Seed-leg indexes for strict and recovery matching
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Seed-leg segment key when matched to the reload scope
 */
const resolveHistorySegmentKey = (
  record: WsfVesselHistory,
  seedLookup: HistorySeedLookup,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): string | undefined =>
  resolveStrictHistorySegmentKey(
    record,
    seedLookup.segmentKeys,
    vessels,
    terminals
  ) ?? resolveHistorySegmentKeyByVesselDeparture(record, seedLookup, vessels);

/**
 * Resolves history identity through vessel and terminal names.
 *
 * @param record - WSF vessel history row
 * @param segmentKeys - Seed-leg keys in scope for this reload
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Seed-leg segment key when strict resolution succeeds
 */
const resolveStrictHistorySegmentKey = (
  record: WsfVesselHistory,
  segmentKeys: Set<string>,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): string | undefined => {
  const resolvedHistory = resolveVesselHistory(
    toAdapterHistoryIdentityRecord(record),
    vessels,
    terminals
  );
  const segmentKey =
    resolvedHistory === null || record.ScheduledDepart === undefined
      ? undefined
      : buildSegmentKey(
          resolvedHistory.vessel.VesselAbbrev,
          resolvedHistory.departingTerminal.TerminalAbbrev,
          resolvedHistory.arrivingTerminal.TerminalAbbrev,
          new Date(record.ScheduledDepart)
        );
  const matchedSegmentKey =
    segmentKey !== undefined && segmentKeys.has(segmentKey)
      ? segmentKey
      : undefined;

  return matchedSegmentKey;
};

/**
 * Resolves history identity by vessel abbrev and scheduled departure.
 *
 * @param record - WSF vessel history row
 * @param seedLookup - Seed-leg indexes for recovery matching
 * @param vessels - Vessel identities used by adapter resolution
 * @returns Seed-leg segment key when recovery matching succeeds
 */
const resolveHistorySegmentKeyByVesselDeparture = (
  record: WsfVesselHistory,
  seedLookup: HistorySeedLookup,
  vessels: ReadonlyArray<VesselIdentity>
): string | undefined => {
  const vessel = tryResolveVessel(String(record.Vessel ?? ""), vessels);
  const segmentKey =
    vessel === null || record.ScheduledDepart === undefined
      ? undefined
      : seedLookup.segmentKeyByVesselDeparture.get(
          toVesselDepartureKey(vessel.VesselAbbrev, record.ScheduledDepart)
        );
  const matchedSegmentKey =
    segmentKey !== undefined && seedLookup.segmentKeys.has(segmentKey)
      ? segmentKey
      : undefined;

  return matchedSegmentKey;
};

/**
 * Finds a scheduled boundary anchored by tracking schedule fields.
 *
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when found
 */
const getTrackingAnchoredBoundary = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  eventType: ActualEvidence["eventType"]
): ScheduledBoundary | undefined => {
  const keyedBoundary = getTrackingKeyedBoundary(
    boundaries,
    location,
    eventType
  );
  const scheduleBoundary = getTrackingScheduleBoundary(
    boundaries,
    location,
    eventType
  );
  const trackingBoundary = keyedBoundary ?? scheduleBoundary;

  return trackingBoundary;
};

/**
 * Finds a scheduled boundary by rebuilding the tracking segment key.
 *
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when the tracking row has full segment identity
 */
const getTrackingKeyedBoundary = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  eventType: ActualEvidence["eventType"]
): ScheduledBoundary | undefined => {
  const segmentKey =
    location.ScheduledDeparture === undefined ||
    location.ArrivingTerminalAbbrev === undefined
      ? undefined
      : buildSegmentKey(
          location.VesselAbbrev,
          location.DepartingTerminalAbbrev,
          location.ArrivingTerminalAbbrev,
          new Date(location.ScheduledDeparture)
        );
  const trackingBoundary =
    segmentKey === undefined
      ? undefined
      : boundaries.find(
          (boundary) => boundary.Key === buildBoundaryKey(segmentKey, eventType)
        );

  return trackingBoundary;
};

/**
 * Finds a scheduled boundary by scheduled departure and dock terminal.
 *
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when schedule fields are sufficient
 */
const getTrackingScheduleBoundary = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  eventType: ActualEvidence["eventType"]
): ScheduledBoundary | undefined =>
  location.ScheduledDeparture === undefined
    ? undefined
    : boundaries.find(
        (boundary) =>
          boundary.EventType === eventType &&
          boundary.ScheduledDeparture === location.ScheduledDeparture &&
          (eventType === "arv-dock" ||
            boundary.TerminalAbbrev === location.DepartingTerminalAbbrev)
      );

/**
 * Finds the most recent prior scheduled arrival supported by tracking.
 *
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param departureBoundary - Matched departure boundary used as the upper bound
 * @returns Prior arrival boundary when tracking is late enough to support it
 */
const findArrivalBoundaryForTracking = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  departureBoundary: ScheduledBoundary | undefined
): ScheduledBoundary | undefined => {
  const scheduledDepartureUpperBound =
    departureBoundary?.ScheduledDeparture ?? location.ScheduledDeparture;
  const arrivalBoundary =
    scheduledDepartureUpperBound === undefined
      ? undefined
      : boundaries
          .filter((boundary) =>
            isEligibleTrackingArrival(
              boundary,
              location,
              scheduledDepartureUpperBound
            )
          )
          .reduce(pickLaterScheduledDeparture, undefined);

  return arrivalBoundary;
};

/**
 * Returns whether tracking state supports the matched boundary type.
 *
 * @param location - Current tracking row
 * @param boundary - Matched scheduled boundary
 * @returns True when the tracking row can produce evidence for the boundary
 */
const trackingStateSupportsBoundary = (
  location: ConvexVesselLocation,
  boundary: ScheduledBoundary
): boolean =>
  boundary.EventType === "dep-dock"
    ? location.LeftDock !== undefined || location.AtDock === false
    : location.AtDock === true;

/**
 * Returns whether a boundary is an eligible prior arrival for tracking.
 *
 * @param boundary - Candidate scheduled boundary
 * @param location - Current tracking row
 * @param scheduledDepartureUpperBound - Exclusive upper bound for prior arrivals
 * @returns True when the boundary is a prior arrival at the current dock and can have occurred
 */
const isEligibleTrackingArrival = (
  boundary: ScheduledBoundary,
  location: ConvexVesselLocation,
  scheduledDepartureUpperBound: number
): boolean =>
  boundary.EventType === "arv-dock" &&
  boundary.TerminalAbbrev === location.DepartingTerminalAbbrev &&
  boundary.ScheduledDeparture < scheduledDepartureUpperBound &&
  getArrivalEligibilityTime(boundary) <= location.TimeStamp;

/**
 * Resolves when tracking may infer an arrival boundary.
 *
 * @param boundary - Candidate arrival boundary
 * @returns Arrival boundary time, falling back to scheduled departure
 */
const getArrivalEligibilityTime = (boundary: ScheduledBoundary): number =>
  boundary.EventScheduledTime ?? boundary.ScheduledDeparture;

/**
 * Picks the later scheduled departure between arrival candidates.
 *
 * @param latest - Current latest arrival candidate
 * @param candidate - Newly eligible arrival candidate
 * @returns Candidate with the later scheduled departure
 */
const pickLaterScheduledDeparture = (
  latest: ScheduledBoundary | undefined,
  candidate: ScheduledBoundary
): ScheduledBoundary =>
  latest === undefined ||
  candidate.ScheduledDeparture > latest.ScheduledDeparture
    ? candidate
    : latest;

/**
 * Finds the final arrival boundary per vessel day.
 *
 * @param boundaries - Scheduled boundaries for the sailing day
 * @returns Boundary keys that close their vessel day
 */
const findLastArrivalKeysByVesselDay = (
  boundaries: ScheduledBoundary[]
): Set<string> =>
  new Set([
    ...boundaries
      .filter((boundary) => boundary.EventType === "arv-dock")
      .reduce(
        (keysByVesselDay, boundary) =>
          new Map(keysByVesselDay).set(toVesselDayKey(boundary), boundary.Key),
        new Map<string, string>()
      )
      .values(),
  ]);

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
 * Returns whether a tracking row belongs to the requested sailing day.
 *
 * @param location - Current tracking row
 * @param sailingDay - Reload sailing day
 * @returns True when scheduled departure or ping time lands on the sailing day
 */
const trackingLocationMatchesSailingDay = (
  location: ConvexVesselLocation,
  sailingDay: string
): boolean =>
  getSailingDay(new Date(location.ScheduledDeparture ?? location.TimeStamp)) ===
  sailingDay;

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
 * Groups values by a string key.
 *
 * @param values - Values to group
 * @param toKey - Key projection for each value
 * @returns Map from projected key to grouped values
 */
const groupBy = <TValue>(
  values: TValue[],
  toKey: (value: TValue) => string
): Map<string, TValue[]> =>
  values.reduce(
    (groups, value) =>
      new Map(groups).set(toKey(value), [
        ...(groups.get(toKey(value)) ?? []),
        value,
      ]),
    new Map<string, TValue[]>()
  );

/**
 * Narrows a reload history row to fields used by adapter identity resolution.
 *
 * @param row - WSF history row with optional timestamp fields
 * @returns Adapter-compatible history identity row
 */
const toAdapterHistoryIdentityRecord = (row: WsfVesselHistory): VesselHistory =>
  ({
    VesselId: row.VesselId,
    Vessel: row.Vessel,
    Departing: row.Departing,
    Arriving: row.Arriving,
  }) as VesselHistory;

/**
 * Returns whether a history row has enough data to produce actual evidence.
 *
 * @param record - WSF history row
 * @returns True when scheduled departure and at least one actual timestamp exist
 */
const canUseHistoryRecord = (record: WsfVesselHistory): boolean =>
  record.ScheduledDepart !== undefined &&
  (record.ActualDepart !== undefined || record.EstArrival !== undefined);

/**
 * Builds the composite vessel and scheduled departure key.
 *
 * @param vesselAbbrev - Vessel abbrev
 * @param scheduledDeparture - Scheduled departure in epoch milliseconds
 * @returns Composite vessel/departure key
 */
const toVesselDepartureKey = (
  vesselAbbrev: string,
  scheduledDeparture: number
) => `${vesselAbbrev}:${scheduledDeparture}`;

/**
 * Builds the composite vessel-day key.
 *
 * @param boundary - Scheduled boundary with vessel and sailing day
 * @returns Composite vessel-day key
 */
const toVesselDayKey = (
  boundary: Pick<ScheduledBoundary, "VesselAbbrev" | "SailingDay">
) => `${boundary.VesselAbbrev}:${boundary.SailingDay}`;

/**
 * Builds the composite TripKey and boundary type key.
 *
 * @param evidence - Actual evidence with TripKey and event type
 * @returns Composite TripKey/event-type key
 */
const toTripBoundaryKey = (
  evidence: Pick<ActualEvidence, "tripKey" | "eventType">
) => `${evidence.tripKey}|${evidence.eventType}`;

export { buildReloadRows };
