/**
 * Seeds dock boundary rows from schedule segments, merges WSF history actuals,
 * and exposes the action-layer hydration entry used before reseed mutations.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type { ConvexReloadDockHistoryRecord } from "functions/events/eventsActual/schemas";
import type { ConvexReloadDockScheduleSegment } from "functions/events/eventsScheduled/schemas";
import {
  mergeActualTime,
  normalizeScheduledDockSeams,
  sortDockBoundaryEventRecords,
} from "./boundarySeams";
import { getHistoryActualsByEventKey } from "./historyActuals";
import {
  buildSeedEventsForSegment,
  getDirectRawSeedSegments,
  getOfficialScheduledArrivalTime,
  normalizeScheduledArrivalTime,
} from "./rawSeedSegments";
import type { DockBoundaryEventRecord } from "./types";

/**
 * Builds schedule-derived boundary records from raw reload segments.
 *
 * @param segments - Numeric schedule reload segments from the sync mutation
 * @param vessels - Vessel identities for WSF segment resolution
 * @param terminals - Terminal identities for WSF segment resolution
 * @returns Direct physical sailing boundary records
 */
const buildScheduledDockEventRecords = (
  segments: ConvexReloadDockScheduleSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): DockBoundaryEventRecord[] =>
  normalizeScheduledDockSeams(
    getDirectRawSeedSegments(segments, vessels, terminals)
      .flatMap((segment) =>
        buildSeedEventsForSegment({
          SailingDay: segment.SailingDay,
          VesselAbbrev: segment.VesselAbbrev,
          ScheduledDeparture: segment.DepartingTime,
          DepartingTerminalAbbrev: segment.DepartingTerminalAbbrev,
          ArrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
          ScheduledArrival: normalizeScheduledArrivalTime(
            segment.ArrivingTime ?? getOfficialScheduledArrivalTime(segment),
            segment.DepartingTime
          ),
        })
      )
      .sort(sortDockBoundaryEventRecords)
  );

/**
 * Hydrates seeded boundary records with WSF history actuals.
 *
 * @param args - Seeded records plus schedule, history, and identity context
 * @returns Boundary records with actual fields merged from history
 */
const hydrateDockEventRecordsWithHistory = ({
  seededEvents,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seededEvents: DockBoundaryEventRecord[];
  scheduleSegments: ConvexReloadDockScheduleSegment[];
  historyRecords: ConvexReloadDockHistoryRecord[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockBoundaryEventRecord[] => {
  const historyActualsByEventKey = getHistoryActualsByEventKey({
    seededEvents,
    scheduleSegments,
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
 * @param args.scheduleSegments - Numeric schedule reload segments
 * @param args.historyRecords - Numeric WSF history rows for the sailing day
 * @param args.vessels - Vessel identities for adapter resolution
 * @param args.terminals - Terminal identities for adapter resolution
 * @returns Hydrated boundary event records for one sailing day
 */
const buildHydratedDockBoundaryEventsForReload = ({
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  scheduleSegments: ConvexReloadDockScheduleSegment[];
  historyRecords: ConvexReloadDockHistoryRecord[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockBoundaryEventRecord[] => {
  const seededEvents = buildScheduledDockEventRecords(
    scheduleSegments,
    vessels,
    terminals
  );
  return hydrateDockEventRecordsWithHistory({
    seededEvents,
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });
};

export {
  buildHydratedDockBoundaryEventsForReload,
  buildScheduledDockEventRecords,
  hydrateDockEventRecordsWithHistory,
};
