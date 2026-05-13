/**
 * Seeds dock boundary rows from schedule segments, merges WSF history actuals,
 * and exposes the action-layer hydration entry used before reseed mutations.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import { buildBoundaryKey } from "shared/keys";
import { getOfficialCrossingTimeMinutes } from "../../../scheduledTrips";
import { mapHistoryActualsToEventKeys } from "../actuals";
import type { WsfScheduledSegment, WsfVesselHistory } from "../schemas";
import {
  ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS,
  DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS,
  IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS,
} from "../shared";
import type {
  DockStatusEventRecord,
  HistoryActualSource,
  RawSeedSegment,
} from "../types";
import { compareDockEventsByTimeline } from "./compareDockEventsByTimeline";
import { resolveSeedSegments } from "./resolveSeedSegments";

/**
 * Hydrates schedule-derived boundary records with WSF history for reload.
 *
 * The reload pipeline expects boundary records that combine the static
 * schedule with any observed actuals from WSF history before downstream
 * actual-row builders run. This entry resolves seed segments, projects them
 * into dep and arv records, then merges history-derived actual times so the
 * caller can stamp dep-actual and arv-proxy values onto the right boundaries.
 *
 * @param args.scheduleSegments - WSF scheduled segments using epoch-ms times
 * @param args.historyRecords - WSF vessel history rows using epoch-ms times
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
  // Resolve and classify segments before any boundary projection runs.
  const seedSegments = resolveSeedSegments(
    scheduleSegments,
    vessels,
    terminals
  );

  // Project dep and arv records first so history merge can stamp them in place.
  const seededEvents = buildScheduledDockEventRecords(seedSegments);

  return hydrateDockEventRecordsWithHistory({
    seededEvents,
    seedSegments,
    historyRecords,
    vessels,
    terminals,
  });
};

/**
 * Builds the seeded boundary record list for one sailing day.
 *
 * @param seedSegments - Direct seed segments resolved from WSF schedule rows
 * @returns Boundary records sorted in timeline order
 */
const buildScheduledDockEventRecords = (
  seedSegments: RawSeedSegment[]
): DockStatusEventRecord[] =>
  seedSegments
    .flatMap((segment) => buildSeedEventsForSegment(segment))
    .sort(compareDockEventsByTimeline);

/**
 * Builds dep and arv boundary records for one seed segment.
 *
 * @param segment - Direct seed segment
 * @returns Departure followed by arrival boundary record
 */
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
 * Nudges scheduled arrival time backward when it equals the dep instant.
 *
 * WSF data occasionally records arrivals at the same instant as their paired
 * departure for short crossings. Reload needs strictly ordered scheduled
 * boundaries within a segment, so this helper subtracts the seam offset to
 * restore dep-before-arv ordering without changing the published schedule.
 *
 * @param scheduledArrival - Scheduled arrival time in epoch milliseconds
 * @param scheduledDeparture - Scheduled departure time in epoch milliseconds
 * @returns Adjusted arrival time or the original value when distinct
 */
const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
) =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

/**
 * Resolves the schedule-implied arrival time when the segment lacks one.
 *
 * Most schedule segments expose ArrivingTime directly, but some legs only
 * carry a departure stamp plus a route-known crossing duration. Route 9 is
 * an exception that always trusts the supplied arrival because its duration
 * varies with tidal currents. Other routes fall back to the official crossing
 * minutes lookup so boundary records still have a usable scheduled arrival.
 *
 * @param segment - Direct seed segment for one physical leg
 * @returns Scheduled arrival in epoch ms, or undefined when unresolvable
 */
const getOfficialScheduledArrivalTime = (segment: RawSeedSegment) => {
  if (segment.RouteID === 9 && segment.ArrivingTime) {
    return segment.ArrivingTime;
  }

  const duration = getOfficialCrossingTimeMinutes({
    routeAbbrev: segment.RouteAbbrev,
    departingTerminalAbbrev: segment.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
  });

  return duration !== undefined
    ? segment.DepartingTime + duration * 60 * 1000
    : undefined;
};

/**
 * Chooses the actual timestamp to keep when history and an existing row disagree.
 *
 * Existing actual times are usually closer to the live ping stream and so take
 * precedence, but WSF history can correct large divergences caused by ping
 * gaps. Replacement thresholds vary by source because arrival proxies are
 * generally less precise than departure actuals, so a smaller window applies
 * before history can overwrite an existing arrival time.
 *
 * @param existingActualTime - Time already on the boundary record
 * @param historyActualTime - Time from WSF history hydration
 * @param source - Whether the history column was departure-actual or arrival-proxy
 * @returns Merged actual ms or undefined when both inputs are undefined
 */
const mergeActualTime = (
  existingActualTime?: number,
  historyActualTime?: number,
  source?: HistoryActualSource
) => {
  if (existingActualTime === undefined) {
    return historyActualTime;
  }

  if (historyActualTime === undefined) {
    return existingActualTime;
  }

  const replacementThreshold =
    source === "arrival-proxy"
      ? ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS
      : DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS;

  return Math.abs(existingActualTime - historyActualTime) >=
    replacementThreshold
    ? historyActualTime
    : existingActualTime;
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
  // Index history actuals by boundary key once before the seeded-event map.
  const historyActualsByEventKey = mapHistoryActualsToEventKeys({
    seededEvents,
    directSeedSegments: seedSegments,
    historyRecords,
    vessels,
    terminals,
  });

  // Merge history actuals into seeded events and clear predicted time once an actual is known.
  return seededEvents.map((event) => {
    const historyActualTime = historyActualsByEventKey.get(event.Key);
    const mergedActualTime = mergeActualTime(
      event.EventActualTime,
      historyActualTime,
      event.EventType === "dep-dock" ? "departure-actual" : "arrival-proxy"
    );

    // Clear predicted time once an actual is known so callers prefer observed.
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

export { hydrateScheduledEvents };
