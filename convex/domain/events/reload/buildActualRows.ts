/**
 * Builds reload actual dock-event rows with explicit source precedence.
 *
 * The reload path writes directly into one row accumulator keyed by physical
 * trip boundary. Each source phase only fills missing rows, so precedence is
 * visible in the main function instead of hidden in candidate transforms.
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
import { groupBy } from "shared/groupBy";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
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

type ActualRowsByBoundary = Map<string, ConvexActualDockEvent>;
type ActualRowDraft = {
  TripKey: string;
  VesselAbbrev: string;
  SailingDay?: string;
  ScheduledDeparture?: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventActualTime?: number;
};

type HistorySeedLookup = {
  segmentKeys: Set<string>;
  segmentKeyByVesselDeparture: Map<string, string>;
};

/**
 * Builds actual dock rows from raw reload inputs.
 *
 * The function applies source precedence as ordered writes into one result
 * map: WSF history first, durable physical trip fields second, scheduled
 * tracking third, and physical-only tracking last. Later phases can fill gaps
 * but cannot replace an already-selected physical boundary row.
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
    (trip): trip is ReloadTripWithTripKey => trip.TripKey !== undefined
  );
  const activeTripsWithKeys = activeTrips.filter(
    (trip): trip is ReloadTripWithTripKey => trip.TripKey !== undefined
  );
  const tripKeyBySegmentKey = new Map(
    tripsWithKeys.map((trip) => [
      trip.ScheduleKey ?? trip.TripKey,
      trip.TripKey,
    ])
  );
  const physicalOnlyTrips = tripsWithKeys.filter(
    (trip) => trip.ScheduleKey === undefined
  );
  const activePhysicalOnlyTripsByVessel = new Map(
    activeTripsWithKeys
      .filter((trip) => trip.ScheduleKey === undefined)
      .map((trip) => [trip.VesselAbbrev, trip])
  );
  const boundariesByVessel = groupBy(
    boundaries,
    (boundary) => boundary.VesselAbbrev
  );
  const locations = vesselLocations.filter((location) =>
    trackingLocationMatchesSailingDay(location, sailingDay)
  );
  const historyActuals = mapHistoryActualsToBoundaryKeys(
    seedLegs,
    historyRecords,
    vessels,
    terminals
  );
  const historyRows = boundaries.flatMap((boundary): ActualRowDraft[] => {
    const actualTime = historyActuals.get(boundary.Key);
    const tripKey = tripKeyBySegmentKey.get(boundary.SegmentKey);

    return actualTime === undefined || tripKey === undefined
      ? []
      : [
          {
            TripKey: tripKey,
            VesselAbbrev: boundary.VesselAbbrev,
            SailingDay: boundary.SailingDay,
            ScheduledDeparture: boundary.ScheduledDeparture,
            TerminalAbbrev: boundary.TerminalAbbrev,
            EventType: boundary.EventType,
            EventActualTime: actualTime,
          },
        ];
  });
  const physicalFieldRows = physicalOnlyTrips.flatMap((trip) =>
    [
      toPhysicalTripDraft(
        trip,
        "dep-dock",
        trip.DepartingTerminalAbbrev,
        trip.LeftDockActual
      ),
      toPhysicalTripDraft(
        trip,
        "arv-dock",
        trip.ArrivingTerminalAbbrev,
        trip.TripEnd
      ),
    ].flatMap((draft) => (draft === undefined ? [] : [draft]))
  );
  const scheduledTrackingRows = locations.flatMap((location) => {
    const vesselBoundaries =
      boundariesByVessel.get(location.VesselAbbrev) ?? [];
    if (vesselBoundaries.length === 0 || location.InService !== true) {
      return [];
    }

    const departureBoundary =
      getTrackingKeyedBoundary(vesselBoundaries, location, "dep-dock") ??
      getTrackingScheduleBoundary(vesselBoundaries, location, "dep-dock");

    const trackingBoundaries: Array<
      [ScheduledBoundary | undefined, number | undefined]
    > = [
      [departureBoundary, location.LeftDock],
      [
        findArrivalBoundaryForTracking(
          vesselBoundaries,
          location,
          departureBoundary
        ),
        undefined,
      ],
    ];

    return trackingBoundaries.flatMap(([boundary, actualTime]) => {
      const draft = toTrackingBoundaryDraft(
        boundary,
        location,
        tripKeyBySegmentKey,
        actualTime
      );

      return draft === undefined ? [] : [draft];
    });
  });
  const physicalTrackingRows = locations.flatMap((location) => {
    const trip = activePhysicalOnlyTripsByVessel.get(location.VesselAbbrev);
    if (location.InService !== true || trip === undefined) {
      return [];
    }

    return [
      location.AtDock === false
        ? toPhysicalTripDraft(
            trip,
            "dep-dock",
            trip.DepartingTerminalAbbrev,
            location.LeftDock ?? location.TimeStamp
          )
        : undefined,
      location.AtDock === true
        ? toPhysicalTripDraft(
            trip,
            "arv-dock",
            trip.ArrivingTerminalAbbrev,
            location.TimeStamp
          )
        : undefined,
    ].flatMap((draft) => (draft === undefined ? [] : [draft]));
  });
  const actualRows = [
    ...historyRows,
    ...physicalFieldRows,
    ...scheduledTrackingRows,
    ...physicalTrackingRows,
  ].reduce(
    (rows, draft) => addRowIfAbsent(rows, draft, updatedAt),
    new Map<string, ConvexActualDockEvent>()
  );

  return [...actualRows.values()];
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
      .filter(
        (trip): trip is ReloadTripWithTripKey => trip.TripKey !== undefined
      )
      .filter((trip) => trip.ScheduleKey === undefined)
      .map((trip) => trip.TripKey)
  );

/**
 * Builds a physical-only trip boundary row draft when required fields exist.
 * @param trip - Physical-only trip carrying row identity
 * @param eventType - Dock boundary type represented by the draft
 * @param terminalAbbrev - Terminal abbreviation for the boundary
 * @param actualTime - Observed boundary time
 * @returns Row draft, or undefined when terminal or actual time is absent
 */
const toPhysicalTripDraft = (
  trip: ReloadTripWithTripKey,
  eventType: DockEventType,
  terminalAbbrev: string | undefined,
  actualTime: number | undefined
): ActualRowDraft | undefined =>
  terminalAbbrev === undefined || actualTime === undefined
    ? undefined
    : {
        TripKey: trip.TripKey,
        VesselAbbrev: trip.VesselAbbrev,
        SailingDay: trip.SailingDay,
        ScheduledDeparture: trip.ScheduledDeparture,
        TerminalAbbrev: terminalAbbrev,
        EventType: eventType,
        EventActualTime: actualTime,
      };

/**
 * Builds a scheduled tracking row draft when vessel state supports a boundary.
 * @param boundary - Matched scheduled boundary
 * @param location - Current tracking row
 * @param tripKeyBySegmentKey - TripKey lookup by scheduled segment key
 * @param actualTime - Observed boundary time when tracking carries one
 * @returns Row draft, or undefined when the boundary is unsupported
 */
const toTrackingBoundaryDraft = (
  boundary: ScheduledBoundary | undefined,
  location: ConvexVesselLocation,
  tripKeyBySegmentKey: Map<string, string>,
  actualTime: number | undefined
): ActualRowDraft | undefined => {
  const supportsBoundary =
    boundary?.EventType === "dep-dock"
      ? location.LeftDock !== undefined || location.AtDock === false
      : location.AtDock === true;
  const tripKey =
    boundary === undefined
      ? undefined
      : tripKeyBySegmentKey.get(boundary.SegmentKey);

  return boundary === undefined || !supportsBoundary || tripKey === undefined
    ? undefined
    : {
        TripKey: tripKey,
        VesselAbbrev: boundary.VesselAbbrev,
        SailingDay: boundary.SailingDay,
        ScheduledDeparture: boundary.ScheduledDeparture,
        TerminalAbbrev: boundary.TerminalAbbrev,
        EventType: boundary.EventType,
        EventActualTime: actualTime,
      };
};

/**
 * Adds one normalized actual row when no higher-priority row exists.
 * @param actualRows - Winning rows keyed by TripKey and event type
 * @param draft - Sparse actual row fields with at least one time anchor
 * @param updatedAt - UpdatedAt timestamp for produced rows
 * @returns Accumulator with the draft added when the key was absent
 */
const addRowIfAbsent = (
  actualRows: ActualRowsByBoundary,
  draft: ActualRowDraft,
  updatedAt: number
): ActualRowsByBoundary => {
  const key = `${draft.TripKey}|${draft.EventType}`;
  if (actualRows.has(key)) {
    return actualRows;
  }

  if (
    draft.EventActualTime === undefined &&
    draft.ScheduledDeparture === undefined
  ) {
    return actualRows;
  }

  actualRows.set(
    key,
    buildActualDockEventFromWrite(
      {
        TripKey: draft.TripKey,
        VesselAbbrev: draft.VesselAbbrev,
        SailingDay: draft.SailingDay,
        ScheduledDeparture: draft.ScheduledDeparture,
        TerminalAbbrev: draft.TerminalAbbrev,
        EventType: draft.EventType,
        EventOccurred: true,
        EventActualTime: draft.EventActualTime,
      } as ConvexActualDockWritePersistable,
      updatedAt
    )
  );
  return actualRows;
};

/**
 * Indexes WSF history actual times by scheduled boundary key.
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
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when the tracking row has full segment identity
 */
const getTrackingKeyedBoundary = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  eventType: DockEventType
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

  return segmentKey === undefined
    ? undefined
    : boundaries.find(
        (boundary) => boundary.Key === buildBoundaryKey(segmentKey, eventType)
      );
};

/**
 * Finds a scheduled boundary by scheduled departure and dock terminal.
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when schedule fields are sufficient
 */
const getTrackingScheduleBoundary = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  eventType: DockEventType
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
  const upperBound =
    departureBoundary?.ScheduledDeparture ?? location.ScheduledDeparture;

  return upperBound === undefined
    ? undefined
    : boundaries
        .filter((boundary) =>
          isEligibleTrackingArrival(boundary, location, upperBound)
        )
        .reduce(
          (latest: ScheduledBoundary | undefined, boundary) =>
            latest === undefined ||
            boundary.ScheduledDeparture > latest.ScheduledDeparture
              ? boundary
              : latest,
          undefined
        );
};

/**
 * Returns whether a boundary is an eligible prior arrival for tracking.
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
  (boundary.EventScheduledTime ?? boundary.ScheduledDeparture) <=
    location.TimeStamp;

/**
 * Returns whether a tracking row belongs to the requested sailing day.
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
