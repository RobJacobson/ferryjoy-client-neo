/**
 * Seeds dock boundary rows from schedule segments, merges WSF history actuals,
 * and exposes the action-layer hydration entry used before reseed mutations.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import { mapHistoryActualsToEventKeys } from "../actuals";
import type {
  DockStatusEventRecord,
  WsfScheduledSegment,
  WsfVesselHistory,
} from "../types";
import {
  mergeActualTime,
  sortDockStatusEventRecords,
} from "./normalizeBoundarySeams";
import {
  buildSeedEventsForSegment,
  getOfficialScheduledArrivalTime,
  normalizeScheduledArrivalTime,
  resolveSeedSegments,
} from "./resolveSeedSegments";

/**
 * Builds schedule-derived boundary records from raw reload segments.
 *
 * Seam normalization for identical scheduled dep and arv times is applied in
 * computeReloadRowsFromScheduledEvents, not here, so callers that only seed
 * should not assume EventScheduledTime is already adjusted.
 *
 * @param segments - WSF scheduled segments (epoch-ms) from reload
 * @param vessels - Vessel identities for WSF segment resolution
 * @param terminals - Terminal identities for WSF segment resolution
 * @returns Direct physical sailing boundary records
 */
const buildScheduledDockEventRecords = (
  segments: WsfScheduledSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): DockStatusEventRecord[] =>
  resolveSeedSegments(segments, vessels, terminals)
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
    .sort(sortDockStatusEventRecords);

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
  seededEvents: DockStatusEventRecord[];
  scheduleSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockStatusEventRecord[] => {
  const historyActualsByEventKey = mapHistoryActualsToEventKeys({
    seededEvents,
    directSeedSegments: resolveSeedSegments(
      scheduleSegments,
      vessels,
      terminals
    ),
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
  buildScheduledDockEventRecords,
  hydrateDockEventRecordsWithHistory,
  hydrateScheduledEvents,
};
