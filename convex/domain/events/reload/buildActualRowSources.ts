/**
 * Add native actual-row sources to event-keyed rows.
 *
 * Each source phase reads one reload input shape and adds rows directly to a
 * plain object. The phase order is owned by buildActualRows, while
 * this module owns source-specific matching and timestamp interpretation.
 */

import {
  resolveVesselHistory,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import {
  type ActualRowsByEventKey,
  addActualRowIfAbsent,
} from "./buildActualRowsByEventKey";
import {
  type ActualBoundary,
  type ActualBoundaryIndex,
  compact,
  DOCK_EVENT_SPECS,
  toSegmentEventKey,
} from "./buildActualRowsShared";
import type { WsfVesselHistory } from "./schemas";
import type { ReloadTripWithTripKey, SeedLeg } from "./types";

type ApplyHistoryActualRowsArgs = {
  seedLegs: SeedLeg[];
  historyRecords: WsfVesselHistory[];
  index: ActualBoundaryIndex;
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
  rowsByEventKey: ActualRowsByEventKey;
  updatedAt: number;
};

type ApplyPhysicalFieldActualRowsArgs = {
  tripsWithKeys: ReloadTripWithTripKey[];
  index: ActualBoundaryIndex;
  rowsByEventKey: ActualRowsByEventKey;
  updatedAt: number;
};

type ApplyTrackingActualRowsArgs = {
  locations: ConvexVesselLocation[];
  index: ActualBoundaryIndex;
  rowsByEventKey: ActualRowsByEventKey;
  updatedAt: number;
};

type HistorySeedLookup = {
  segmentKeys: Set<string>;
  segmentKeyByVesselDeparture: Map<string, string>;
};

/**
 * Adds actual rows supported by WSF history.
 *
 * History is the highest-priority source for scheduled trip boundaries. It is
 * resolved back to scheduled boundary identity before rows are added, so
 * source precedence does not depend on mixing history candidates with lower
 * priority data.
 *
 * @param args - History records, seed legs, identity tables, boundary index, rowsByEventKey, and timestamp
 * @returns Nothing; matching history rows are added to rowsByEventKey
 */
const applyHistoryActualRows = ({
  seedLegs,
  historyRecords,
  index,
  vessels,
  terminals,
  rowsByEventKey,
  updatedAt,
}: ApplyHistoryActualRowsArgs): void => {
  const actualTimeByBoundaryKey = mapHistoryActualsToBoundaryKeys(
    seedLegs,
    historyRecords,
    vessels,
    terminals
  );

  for (const [boundaryKey, boundary] of index.byBoundaryKey.entries()) {
    const actualTime = actualTimeByBoundaryKey.get(boundaryKey);

    if (actualTime !== undefined) {
      addActualRowIfAbsent(rowsByEventKey, boundary, updatedAt, actualTime);
    }
  }
};

/**
 * Adds actual rows supported by durable physical trip fields.
 *
 * Physical-only trips can carry observed timestamps independently of the
 * scheduled reload slice. This phase adds those durable fields before
 * current tracking is allowed to infer rows for the same physical trip.
 *
 * @param args - Keyed trips, boundary index, rowsByEventKey, and timestamp
 * @returns Nothing; physical field rows are added to rowsByEventKey
 */
const applyPhysicalFieldActualRows = ({
  tripsWithKeys,
  index,
  rowsByEventKey,
  updatedAt,
}: ApplyPhysicalFieldActualRowsArgs): void => {
  for (const trip of tripsWithKeys) {
    if (trip.ScheduleKey !== undefined) {
      continue;
    }

    for (const [eventType, , , tripActual] of DOCK_EVENT_SPECS) {
      const actualTime = trip[tripActual];

      if (actualTime !== undefined) {
        addActualRowIfAbsent(
          rowsByEventKey,
          index.byPhysicalSegmentEventKey.get(
            toSegmentEventKey(trip.TripKey, eventType)
          ),
          updatedAt,
          actualTime
        );
      }
    }
  }
};

/**
 * Adds scheduled actual rows inferred from current tracking.
 *
 * Scheduled tracking is lower priority than history because it can only infer
 * event status from the vessel location feed. It still fills scheduled
 * rows that history did not observe, including rows anchored by schedule time
 * when no precise actual timestamp exists.
 *
 * @param args - Filtered tracking rows, boundary index, rowsByEventKey, and timestamp
 * @returns Nothing; scheduled tracking rows are added to rowsByEventKey
 */
const applyScheduledTrackingActualRows = ({
  locations,
  index,
  rowsByEventKey,
  updatedAt,
}: ApplyTrackingActualRowsArgs): void => {
  for (const location of locations) {
    if (location.InService !== true) {
      continue;
    }

    const departure =
      findTrackingKeyedBoundary(index, location, "dep-dock") ??
      findTrackingScheduleBoundary(index, location, "dep-dock");

    const arrival = findPriorScheduledTrackingArrival(
      index,
      location,
      departure
    );

    if (
      departure !== undefined &&
      (location.LeftDock !== undefined || location.AtDock === false)
    ) {
      addActualRowIfAbsent(
        rowsByEventKey,
        departure,
        updatedAt,
        location.LeftDock
      );
    }

    if (arrival !== undefined && location.AtDock === true) {
      addActualRowIfAbsent(rowsByEventKey, arrival, updatedAt);
    }
  }
};

/**
 * Adds physical-only actual rows inferred from current tracking.
 *
 * Physical-only tracking is the lowest-priority source because it infers
 * active trip boundaries from the current vessel location. It can fill gaps left
 * by durable physical fields but cannot replace them.
 *
 * @param args - Filtered tracking rows, boundary index, rowsByEventKey, and timestamp
 * @returns Nothing; physical-only tracking rows are added to rowsByEventKey
 */
const applyPhysicalTrackingActualRows = ({
  locations,
  index,
  rowsByEventKey,
  updatedAt,
}: ApplyTrackingActualRowsArgs): void => {
  for (const location of locations) {
    const boundaries = index.byActivePhysicalVesselAbbrev.get(
      location.VesselAbbrev
    );
    if (location.InService !== true || boundaries === undefined) {
      continue;
    }

    if (location.AtDock === false) {
      addActualRowIfAbsent(
        rowsByEventKey,
        boundaries.departure,
        updatedAt,
        location.LeftDock ?? location.TimeStamp
      );
      continue;
    }

    if (location.AtDock === true) {
      addActualRowIfAbsent(
        rowsByEventKey,
        boundaries.arrival,
        updatedAt,
        location.TimeStamp
      );
    }
  }
};

/**
 * Filters current tracking rows down to rows that can affect the reload day.
 *
 * Tracking rows can belong to the day through either scheduled departure or
 * ping time, which matters for physical-only trips that do not have complete
 * scheduled identity. Keeping the filter here gives all tracking sources the
 * same day boundary behavior.
 *
 * @param locations - Current tracking locations
 * @param sailingDay - Reload sailing day
 * @returns Tracking rows whose scheduled departure or ping time lands on the sailing day
 */
const filterActualTrackingLocations = (
  locations: ConvexVesselLocation[],
  sailingDay: string
): ConvexVesselLocation[] =>
  locations.filter((location) =>
    trackingLocationMatchesSailingDay(location, sailingDay)
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

  return compact(
    ...DOCK_EVENT_SPECS.map(([eventType, , , , historyActual]) => {
      const actualTime = record[historyActual];

      return actualTime === undefined
        ? undefined
        : ([buildBoundaryKey(segmentKey, eventType), actualTime] as [
            string,
            number,
          ]);
    })
  );
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
      : index.byScheduledSegmentEventKey.get(
          toSegmentEventKey(segmentKey, eventType)
        );

  return boundary;
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

export {
  applyHistoryActualRows,
  applyPhysicalFieldActualRows,
  applyPhysicalTrackingActualRows,
  applyScheduledTrackingActualRows,
  filterActualTrackingLocations,
};
