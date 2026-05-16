/**
 * Builds reload actual dock-event rows with explicit source precedence.
 *
 * The reload path first normalizes scheduled and physical-only trip boundaries
 * into one lookup index. Source phases then emit lightweight occurrences
 * against those boundaries, and final row construction happens in one place.
 */

import {
  resolveVesselHistory,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";
import { getSailingDay } from "shared/time";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import {
  buildActualDockEventFromWrite,
  type ConvexActualDockWritePersistable,
} from "../actual";
import type { WsfVesselHistory } from "./schemas";
import type {
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

type ActualBoundary = {
  EventKey: string;
  TripKey: string;
  VesselAbbrev: string;
  SailingDay?: string;
  ScheduledDeparture?: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  SegmentKey?: string;
  BoundaryKey?: string;
  Source: "scheduled" | "physical";
};

type ScheduledActualBoundary = ActualBoundary & {
  Source: "scheduled";
  ScheduledDeparture: number;
  SegmentKey: string;
  BoundaryKey: string;
};

type ActualOccurrence = {
  boundary: ActualBoundary;
  actualTime?: number;
};

type ActualBoundaryIndex = {
  byBoundaryKey: Map<string, ActualBoundary>;
  bySegmentEventKey: Map<string, ActualBoundary>;
  byVesselAbbrev: Map<string, ActualBoundary[]>;
  byActivePhysicalVesselAbbrev: Map<string, PhysicalTripBoundaries>;
};

type PhysicalTripBoundaries = {
  departure?: ActualBoundary;
  arrival?: ActualBoundary;
};

type HistorySeedLookup = {
  segmentKeys: Set<string>;
  segmentKeyByVesselDeparture: Map<string, string>;
};

/**
 * Builds actual dock rows from raw reload inputs.
 *
 * The function applies source precedence as ordered occurrence streams: WSF
 * history first, durable physical trip fields second, scheduled tracking
 * third, and physical-only tracking last. Later phases can fill gaps but
 * cannot replace an already-selected physical boundary row.
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
  const tripsWithKeys = [...activeTrips, ...completedTrips].filter(
    isTripWithTripKey
  );
  const activeTripsWithKeys = activeTrips.filter(isTripWithTripKey);
  const index = buildActualBoundaryIndex(
    boundaries,
    tripsWithKeys,
    activeTripsWithKeys
  );
  const locations = vesselLocations.filter((location) =>
    trackingLocationMatchesSailingDay(location, sailingDay)
  );
  const occurrences = [
    ...historyOccurrences(seedLegs, historyRecords, index, vessels, terminals),
    ...physicalFieldOccurrences(tripsWithKeys, index),
    ...scheduledTrackingOccurrences(locations, index),
    ...physicalTrackingOccurrences(locations, index),
  ];

  return firstRowsByEventKey(occurrences, updatedAt);
};

/**
 * Builds the preserve set for physical-only actual replacement.
 *
 * Physical-only trips are not fully represented by the scheduled reload slice,
 * so replacement persistence needs to retain absent rows for their TripKeys.
 *
 * @param activeTrips - Active trip rows that may include physical-only TripKeys
 * @param completedTrips - Completed trip rows that may include physical-only TripKeys
 * @returns Physical-only TripKeys whose absent rows should be preserved
 */
const buildPreserveAbsentTripKeys = (
  activeTrips: ReloadTripInput[],
  completedTrips: ReloadTripInput[]
): Set<string> =>
  new Set(
    [...activeTrips, ...completedTrips]
      .filter(isTripWithTripKey)
      .filter((trip) => trip.ScheduleKey === undefined)
      .map((trip) => trip.TripKey)
  );

/**
 * Returns whether a reload trip carries persisted trip identity.
 *
 * @param trip - Reload trip input from active or completed trip storage
 * @returns True when the trip has a TripKey usable for actual rows
 */
const isTripWithTripKey = (
  trip: ReloadTripInput
): trip is ReloadTripWithTripKey => trip.TripKey !== undefined;

/**
 * Builds lookup maps for scheduled and physical-only actual boundaries.
 * @param boundaries - Scheduled dock boundaries in reload scope
 * @param tripsWithKeys - Active and completed trips with TripKey identity
 * @param activeTripsWithKeys - Active trips with TripKey identity
 * @returns Boundary lookup maps used by actual occurrence sources
 */
const buildActualBoundaryIndex = (
  boundaries: ScheduledBoundary[],
  tripsWithKeys: ReloadTripWithTripKey[],
  activeTripsWithKeys: ReloadTripWithTripKey[]
): ActualBoundaryIndex => {
  const index: ActualBoundaryIndex = {
    byBoundaryKey: new Map(),
    bySegmentEventKey: new Map(),
    byVesselAbbrev: new Map(),
    byActivePhysicalVesselAbbrev: new Map(),
  };
  const tripKeyBySegmentKey = new Map(
    tripsWithKeys.map((trip) => [
      trip.ScheduleKey ?? trip.TripKey,
      trip.TripKey,
    ])
  );

  for (const boundary of boundaries) {
    const tripKey = tripKeyBySegmentKey.get(boundary.SegmentKey);
    if (tripKey === undefined) {
      continue;
    }

    const actualBoundary = toScheduledBoundary(boundary, tripKey);
    index.byBoundaryKey.set(actualBoundary.BoundaryKey, actualBoundary);
    index.bySegmentEventKey.set(
      toSegmentEventKey(actualBoundary.SegmentKey, actualBoundary.EventType),
      actualBoundary
    );
    index.byVesselAbbrev.set(actualBoundary.VesselAbbrev, [
      ...(index.byVesselAbbrev.get(actualBoundary.VesselAbbrev) ?? []),
      actualBoundary,
    ]);
  }

  for (const trip of tripsWithKeys.filter(
    (trip) => trip.ScheduleKey === undefined
  )) {
    for (const boundary of Object.values(toPhysicalTripBoundaries(trip))) {
      if (boundary === undefined || boundary.SegmentKey === undefined) {
        continue;
      }

      index.bySegmentEventKey.set(
        toSegmentEventKey(boundary.SegmentKey, boundary.EventType),
        boundary
      );
    }
  }

  for (const trip of activeTripsWithKeys.filter(
    (trip) => trip.ScheduleKey === undefined
  )) {
    index.byActivePhysicalVesselAbbrev.set(
      trip.VesselAbbrev,
      toPhysicalTripBoundaries(trip)
    );
  }

  return index;
};

/**
 * Builds an actual boundary from a scheduled dock boundary.
 *
 * @param boundary - Scheduled boundary with segment identity
 * @param tripKey - TripKey resolved for the scheduled segment
 * @returns Actual boundary attached to the resolved trip
 */
const toScheduledBoundary = (
  boundary: ScheduledBoundary,
  tripKey: string
): ScheduledActualBoundary => ({
  EventKey: buildPhysicalActualEventKey(tripKey, boundary.EventType),
  TripKey: tripKey,
  VesselAbbrev: boundary.VesselAbbrev,
  SailingDay: boundary.SailingDay,
  ScheduledDeparture: boundary.ScheduledDeparture,
  TerminalAbbrev: boundary.TerminalAbbrev,
  EventType: boundary.EventType,
  EventScheduledTime: boundary.EventScheduledTime,
  SegmentKey: boundary.SegmentKey,
  BoundaryKey: boundary.Key,
  Source: "scheduled",
});

/**
 * Builds physical-only departure and arrival boundaries for one trip.
 *
 * @param trip - Physical-only trip carrying actual row identity
 * @returns Physical boundaries supported by the trip terminal fields
 */
const toPhysicalTripBoundaries = (
  trip: ReloadTripWithTripKey
): PhysicalTripBoundaries => ({
  departure: toPhysicalTripBoundary(
    trip,
    "dep-dock",
    trip.DepartingTerminalAbbrev
  ),
  arrival: toPhysicalTripBoundary(
    trip,
    "arv-dock",
    trip.ArrivingTerminalAbbrev
  ),
});

/**
 * Builds one physical-only actual boundary when terminal identity exists.
 *
 * @param trip - Physical-only trip carrying actual row identity
 * @param eventType - Dock boundary type represented by the boundary
 * @param terminalAbbrev - Terminal abbreviation for the boundary
 * @returns Actual boundary, or undefined when terminal identity is absent
 */
const toPhysicalTripBoundary = (
  trip: ReloadTripWithTripKey,
  eventType: DockEventType,
  terminalAbbrev: string | undefined
): ActualBoundary | undefined =>
  terminalAbbrev === undefined
    ? undefined
    : {
        EventKey: buildPhysicalActualEventKey(trip.TripKey, eventType),
        TripKey: trip.TripKey,
        VesselAbbrev: trip.VesselAbbrev,
        SailingDay: trip.SailingDay,
        ScheduledDeparture: trip.ScheduledDeparture,
        TerminalAbbrev: terminalAbbrev,
        EventType: eventType,
        SegmentKey: trip.TripKey,
        Source: "physical",
      };

/**
 * Builds history occurrences from WSF history rows.
 *
 * @param seedLegs - Direct seed legs in scope for this reload
 * @param historyRecords - WSF vessel history rows
 * @param index - Actual boundary lookup index
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns History-backed occurrences in scheduled boundary order
 */
const historyOccurrences = (
  seedLegs: SeedLeg[],
  historyRecords: WsfVesselHistory[],
  index: ActualBoundaryIndex,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ActualOccurrence[] => {
  const actualTimeByBoundaryKey = mapHistoryActualsToBoundaryKeys(
    seedLegs,
    historyRecords,
    vessels,
    terminals
  );

  return [...index.byBoundaryKey.entries()].flatMap(([boundaryKey, boundary]) =>
    present(toOccurrence(boundary, actualTimeByBoundaryKey.get(boundaryKey)))
  );
};

/**
 * Builds durable physical-only occurrences from trip actual fields.
 *
 * @param tripsWithKeys - Active and completed trips with TripKey identity
 * @param index - Actual boundary lookup index
 * @returns Occurrences backed by durable physical trip timestamps
 */
const physicalFieldOccurrences = (
  tripsWithKeys: ReloadTripWithTripKey[],
  index: ActualBoundaryIndex
): ActualOccurrence[] =>
  tripsWithKeys
    .filter((trip) => trip.ScheduleKey === undefined)
    .flatMap((trip) =>
      [
        toOccurrence(
          index.bySegmentEventKey.get(
            toSegmentEventKey(trip.TripKey, "dep-dock")
          ),
          trip.LeftDockActual
        ),
        toOccurrence(
          index.bySegmentEventKey.get(
            toSegmentEventKey(trip.TripKey, "arv-dock")
          ),
          trip.TripEnd
        ),
      ].flatMap(present)
    );

/**
 * Builds scheduled occurrences inferred from current tracking rows.
 *
 * @param locations - Tracking locations already filtered to the reload sailing day
 * @param index - Actual boundary lookup index
 * @returns Scheduled tracking occurrences in location order
 */
const scheduledTrackingOccurrences = (
  locations: ConvexVesselLocation[],
  index: ActualBoundaryIndex
): ActualOccurrence[] =>
  locations.flatMap((location) => {
    if (location.InService !== true) {
      return [];
    }

    const departure =
      findTrackingKeyedBoundary(index, location, "dep-dock") ??
      findTrackingScheduleBoundary(index, location, "dep-dock");

    const arrival = findPriorScheduledTrackingArrival(
      index,
      location,
      departure
    );

    return [
      departure !== undefined &&
      (location.LeftDock !== undefined || location.AtDock === false)
        ? { boundary: departure, actualTime: location.LeftDock }
        : undefined,
      arrival !== undefined && location.AtDock === true
        ? { boundary: arrival, actualTime: undefined }
        : undefined,
    ].flatMap(present);
  });

/**
 * Builds physical-only occurrences inferred from current tracking rows.
 *
 * @param locations - Tracking locations already filtered to the reload sailing day
 * @param index - Actual boundary lookup index
 * @returns Physical-only tracking occurrences in location order
 */
const physicalTrackingOccurrences = (
  locations: ConvexVesselLocation[],
  index: ActualBoundaryIndex
): ActualOccurrence[] =>
  locations.flatMap((location) => {
    const boundaries = index.byActivePhysicalVesselAbbrev.get(
      location.VesselAbbrev
    );
    if (location.InService !== true || boundaries === undefined) {
      return [];
    }

    if (location.AtDock === false) {
      return present(
        toOccurrence(
          boundaries.departure,
          location.LeftDock ?? location.TimeStamp
        )
      );
    }

    return location.AtDock === true
      ? present(toOccurrence(boundaries.arrival, location.TimeStamp))
      : [];
  });

/**
 * Builds an occurrence from a boundary and optional timestamp.
 *
 * @param boundary - Actual boundary that may have occurred
 * @param actualTime - Observed timestamp for the occurrence
 * @returns Occurrence, or undefined when the boundary is absent or timestamp is absent
 */
const toOccurrence = (
  boundary: ActualBoundary | undefined,
  actualTime: number | undefined
): ActualOccurrence | undefined =>
  boundary === undefined || actualTime === undefined
    ? undefined
    : {
        boundary,
        actualTime,
      };

/**
 * Removes undefined values from optional helper results.
 *
 * @param value - Optional value produced by a source helper
 * @returns Empty array for undefined, otherwise a single-value array
 */
const present = <T>(value: T | undefined): T[] =>
  value === undefined ? [] : [value];

/**
 * Builds actual rows from ordered occurrences while preserving first source wins.
 *
 * @param occurrences - Occurrences ordered by reload source precedence
 * @param updatedAt - UpdatedAt timestamp for produced rows
 * @returns Unique actual rows in first-observed event order
 */
const firstRowsByEventKey = (
  occurrences: ActualOccurrence[],
  updatedAt: number
): ConvexActualDockEvent[] => {
  const rowsByEventKey = new Map<string, ConvexActualDockEvent>();
  for (const occurrence of occurrences) {
    if (
      rowsByEventKey.has(occurrence.boundary.EventKey) ||
      (occurrence.actualTime === undefined &&
        occurrence.boundary.ScheduledDeparture === undefined)
    ) {
      continue;
    }

    rowsByEventKey.set(
      occurrence.boundary.EventKey,
      toActualRow(occurrence, updatedAt)
    );
  }

  return [...rowsByEventKey.values()];
};

/**
 * Builds one persisted actual row from a normalized occurrence.
 *
 * @param occurrence - Boundary occurrence to persist
 * @param updatedAt - UpdatedAt timestamp for the produced row
 * @returns Validator-shaped actual dock-event row
 */
const toActualRow = (
  occurrence: ActualOccurrence,
  updatedAt: number
): ConvexActualDockEvent =>
  buildActualDockEventFromWrite(
    {
      EventKey: occurrence.boundary.EventKey,
      TripKey: occurrence.boundary.TripKey,
      VesselAbbrev: occurrence.boundary.VesselAbbrev,
      SailingDay: occurrence.boundary.SailingDay,
      ScheduledDeparture: occurrence.boundary.ScheduledDeparture,
      TerminalAbbrev: occurrence.boundary.TerminalAbbrev,
      EventType: occurrence.boundary.EventType,
      EventOccurred: true,
      EventActualTime: occurrence.actualTime,
    } as ConvexActualDockWritePersistable,
    updatedAt
  );

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
  const seedLookup = {
    segmentKeys: new Set(seedLegs.map((leg) => leg.Key)),
    segmentKeyByVesselDeparture: new Map(
      seedLegs.map((leg) => [
        `${leg.VesselAbbrev}:${leg.DepartingTime}`,
        leg.Key,
      ])
    ),
  };
  const entries = historyRecords.flatMap((record) =>
    historyRecordToBoundaryEntries(record, seedLookup, vessels, terminals)
  );

  return new Map(entries);
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
  if (
    record.ScheduledDepart === undefined ||
    (record.ActualDepart === undefined && record.EstArrival === undefined)
  ) {
    return [];
  }

  const resolvedHistory = resolveVesselHistory(
    {
      VesselId: record.VesselId,
      Vessel: record.Vessel,
      Departing: record.Departing,
      Arriving: record.Arriving,
    } as VesselHistory,
    vessels,
    terminals
  );
  const strictSegmentKey =
    resolvedHistory === null
      ? undefined
      : buildSegmentKey(
          resolvedHistory.vessel.VesselAbbrev,
          resolvedHistory.departingTerminal.TerminalAbbrev,
          resolvedHistory.arrivingTerminal.TerminalAbbrev,
          new Date(record.ScheduledDepart)
        );
  const vessel = tryResolveVessel(String(record.Vessel ?? ""), vessels);
  const recoverySegmentKey =
    vessel === null
      ? undefined
      : seedLookup.segmentKeyByVesselDeparture.get(
          `${vessel.VesselAbbrev}:${record.ScheduledDepart}`
        );
  const segmentKey =
    strictSegmentKey !== undefined &&
    seedLookup.segmentKeys.has(strictSegmentKey)
      ? strictSegmentKey
      : recoverySegmentKey;

  if (segmentKey === undefined) {
    return [];
  }

  const entries: Array<[string, number]> = [];
  if (record.ActualDepart !== undefined) {
    entries.push([
      buildBoundaryKey(segmentKey, "dep-dock"),
      record.ActualDepart,
    ]);
  }
  if (record.EstArrival !== undefined) {
    entries.push([buildBoundaryKey(segmentKey, "arv-dock"), record.EstArrival]);
  }

  return entries;
};

/**
 * Finds a scheduled boundary by rebuilding the tracking segment key.
 *
 * @param index - Actual boundary lookup index
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when the tracking row has full segment identity
 */
const findTrackingKeyedBoundary = (
  index: ActualBoundaryIndex,
  location: ConvexVesselLocation,
  eventType: DockEventType
): ActualBoundary | undefined => {
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
  const boundary =
    segmentKey === undefined
      ? undefined
      : index.bySegmentEventKey.get(toSegmentEventKey(segmentKey, eventType));

  return boundary?.Source === "scheduled" ? boundary : undefined;
};

/**
 * Finds a scheduled boundary by scheduled departure and dock terminal.
 *
 * @param index - Actual boundary lookup index
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when schedule fields are sufficient
 */
const findTrackingScheduleBoundary = (
  index: ActualBoundaryIndex,
  location: ConvexVesselLocation,
  eventType: DockEventType
): ActualBoundary | undefined =>
  location.ScheduledDeparture === undefined
    ? undefined
    : (index.byVesselAbbrev.get(location.VesselAbbrev) ?? []).find(
        (boundary) =>
          boundary.EventType === eventType &&
          boundary.ScheduledDeparture === location.ScheduledDeparture &&
          (eventType === "arv-dock" ||
            boundary.TerminalAbbrev === location.DepartingTerminalAbbrev)
      );

/**
 * Finds the most recent prior scheduled arrival supported by tracking.
 *
 * @param index - Actual boundary lookup index
 * @param location - Current tracking row
 * @param departureBoundary - Matched departure boundary used as the upper bound
 * @returns Prior arrival boundary when tracking is late enough to support it
 */
const findPriorScheduledTrackingArrival = (
  index: ActualBoundaryIndex,
  location: ConvexVesselLocation,
  departureBoundary: ActualBoundary | undefined
): ActualBoundary | undefined => {
  const upperBound =
    departureBoundary?.ScheduledDeparture ?? location.ScheduledDeparture;

  return upperBound === undefined
    ? undefined
    : (index.byVesselAbbrev.get(location.VesselAbbrev) ?? [])
        .filter((boundary) =>
          isEligibleTrackingArrival(boundary, location, upperBound)
        )
        .reduce(
          (latest: ActualBoundary | undefined, boundary) =>
            latest === undefined ||
            (boundary.ScheduledDeparture ?? 0) >
              (latest.ScheduledDeparture ?? 0)
              ? boundary
              : latest,
          undefined
        );
};

/**
 * Returns whether a boundary is an eligible prior arrival for tracking.
 *
 * @param boundary - Candidate scheduled boundary
 * @param location - Current tracking row
 * @param scheduledDepartureUpperBound - Exclusive upper bound for prior arrivals
 * @returns True when the boundary is a prior arrival at the current dock and can have occurred
 */
const isEligibleTrackingArrival = (
  boundary: ActualBoundary,
  location: ConvexVesselLocation,
  scheduledDepartureUpperBound: number
): boolean =>
  boundary.EventType === "arv-dock" &&
  boundary.ScheduledDeparture !== undefined &&
  boundary.TerminalAbbrev === location.DepartingTerminalAbbrev &&
  boundary.ScheduledDeparture < scheduledDepartureUpperBound &&
  (boundary.EventScheduledTime ?? boundary.ScheduledDeparture) <=
    location.TimeStamp;

/**
 * Builds the segment-event lookup key.
 * @param segmentKey - Scheduled segment key or physical-only trip key
 * @param eventType - Dock boundary type
 * @returns Composite key for boundary lookup maps
 */
const toSegmentEventKey = (
  segmentKey: string,
  eventType: DockEventType
): string => `${segmentKey}|${eventType}`;

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

export { buildActualRows, buildPreserveAbsentTripKeys };
