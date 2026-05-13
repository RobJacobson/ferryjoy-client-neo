/**
 * Seeds dock boundary rows from schedule segments, merges WSF history actuals,
 * and exposes the action-layer hydration entry used before reseed mutations.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import { buildBoundaryKey } from "shared/keys";
import { mapHistoryActualsToEventKeys } from "../actuals";
import type {
  WsfScheduledSegment,
  WsfVesselHistory,
} from "../schemas/validateReloadInput";
import type { DockStatusEventRecord, RawSeedSegment } from "../types";
import {
  mergeActualTime,
  sortDockStatusEventRecords,
} from "./normalizeBoundarySeams";
import {
  getOfficialScheduledArrivalTime,
  normalizeScheduledArrivalTime,
  resolveSeedSegments,
} from "./resolveSeedSegments";

const buildScheduledDockEventRecords = (
  seedSegments: RawSeedSegment[]
): DockStatusEventRecord[] =>
  seedSegments
    .flatMap((segment) => buildSeedEventsForSegment(segment))
    .sort(sortDockStatusEventRecords);

const buildSeedEventsForSegment = (
  segment: RawSeedSegment
): [DockStatusEventRecord, DockStatusEventRecord] => {
  const scheduledArrival = normalizeScheduledArrivalTime(
    segment.ArrivingTime ?? getOfficialScheduledArrivalTime(segment),
    segment.DepartingTime
  );

  return [
    {
      SegmentKey: segment.Key,
      Key: buildBoundaryKey(segment.Key, "dep-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.DepartingTime,
      TerminalAbbrev: segment.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventScheduledTime: segment.DepartingTime,
    },
    {
      SegmentKey: segment.Key,
      Key: buildBoundaryKey(segment.Key, "arv-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.DepartingTime,
      TerminalAbbrev: segment.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventScheduledTime: scheduledArrival,
    },
  ];
};

/**
 * Hydrates seeded boundary records with WSF history actuals.
 *
 * @param args - Seeded records plus schedule, history, and identity context
 * @returns Boundary records with actual fields merged from history
 */
const hydrateDockEventRecordsWithHistory = ({
  seededEvents,
  seedSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seededEvents: DockStatusEventRecord[];
  seedSegments: RawSeedSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockStatusEventRecord[] => {
  const historyActualsByEventKey = mapHistoryActualsToEventKeys({
    seededEvents,
    directSeedSegments: seedSegments,
    historyRecords,
    vessels,
    terminals,
  });

  return seededEvents.map((event) => {
    const historyActualTime = historyActualsByEventKey.get(event.Key);
    const mergedActualTime = mergeActualTime(
      event.EventActualTime,
      historyActualTime,
      event.EventType === "dep-dock" ? "departure-actual" : "arrival-proxy"
    );

    return {
      ...event,
      EventOccurred:
        mergedActualTime !== undefined ? true : event.EventOccurred,
      EventActualTime: mergedActualTime,
      EventPredictedTime:
        mergedActualTime === undefined ? event.EventPredictedTime : undefined,
    };
  });
};

/**
 * Hydrates schedule-derived boundary records with WSF history for reload.
 *
 * @param args.scheduleSegments - WSF scheduled segments (epoch-ms times)
 * @param args.historyRecords - WSF vessel history rows (epoch-ms times)
 * @param args.vessels - Vessel identities for adapter resolution
 * @param args.terminals - Terminal identities for adapter resolution
 * @returns Hydrated boundary event records for one sailing day
 */
const hydrateScheduledEvents = ({
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  scheduleSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockStatusEventRecord[] => {
  const seedSegments = resolveSeedSegments(
    scheduleSegments,
    vessels,
    terminals
  );
  const seededEvents = buildScheduledDockEventRecords(seedSegments);

  return hydrateDockEventRecordsWithHistory({
    seededEvents,
    seedSegments,
    historyRecords,
    vessels,
    terminals,
  });
};

export {
  buildScheduledDockEventRecords,
  hydrateDockEventRecordsWithHistory,
  hydrateScheduledEvents,
};
