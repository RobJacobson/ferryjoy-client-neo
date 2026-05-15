/**
 * Builds vessel-scoped reload boundary events from direct physical seed segments.
 *
 * Reload persists a full sailing day at once; this module groups seeds by vessel
 * and sailing day. Each direct segment emits one departure and one arrival
 * boundary, history actuals overlay by key, and same-terminal turnaround policy
 * applies when the next segment departs from the arrival terminal.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import { buildBoundaryKey } from "shared/keys";
import { getOfficialCrossingTimeMinutes } from "../../../scheduledTrips";
import type { WsfVesselHistory } from "../schemas";
import type { DockStatusEventRecord, RawSeedSegment } from "../types";
import { mapHistoryActualsToEventKeys } from "./mapHistoryActualsToEventKeys";

const MINIMUM_SAME_TERMINAL_TURNAROUND_MS = 5 * 60 * 1000;

/**
 * Builds boundary events for one reload batch from resolved direct seeds.
 *
 * The outer reload mutation replaces a whole sailing day, but this helper
 * groups direct seed segments by vessel and sailing day before emitting rows.
 * That keeps same-vessel continuity decisions, including minimum dock
 * turnaround handling, local to the boundary stage where they stay consistent
 * for both scheduled projection and actual synthesis.
 *
 * @param seedSegments - Direct seed segments for the reload batch
 * @param historyRecords - WSF vessel history rows for the sailing day
 * @param vessels - Vessel identities for adapter resolution of history rows
 * @param terminals - Terminal identities for adapter resolution of history rows
 * @returns Boundary records grouped by vessel day with history actuals overlaid
 */
const buildReloadBoundaryEvents = ({
  seedSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seedSegments: RawSeedSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): DockStatusEventRecord[] => {
  const historyActualsByEventKey = mapHistoryActualsToEventKeys(
    seedSegments,
    historyRecords,
    vessels,
    terminals
  );

  return [...groupSeedSegmentsByVesselDay(seedSegments).values()].flatMap(
    (vesselDaySegments) =>
      buildBoundaryEventsForVesselDay(
        vesselDaySegments,
        historyActualsByEventKey
      )
  );
};

/**
 * Groups seed segments by vessel and sailing day.
 *
 * @param seedSegments - Direct seed segments for the reload batch
 * @returns Map from vessel-day scope to direct segments in input order
 */
const groupSeedSegmentsByVesselDay = (
  seedSegments: RawSeedSegment[]
): Map<string, RawSeedSegment[]> => {
  const seedSegmentsByVesselDay = new Map<string, RawSeedSegment[]>();

  for (const segment of seedSegments) {
    const key = toVesselDayKey(segment);
    seedSegmentsByVesselDay.set(key, [
      ...(seedSegmentsByVesselDay.get(key) ?? []),
      segment,
    ]);
  }

  return seedSegmentsByVesselDay;
};

/**
 * Builds boundary records for one vessel and sailing day.
 *
 * @param seedSegments - Direct seed segments sharing a vessel and sailing day
 * @param historyActualsByEventKey - History actual times indexed by boundary key
 * @returns Departure and arrival records in scheduled departure order
 */
const buildBoundaryEventsForVesselDay = (
  seedSegments: RawSeedSegment[],
  historyActualsByEventKey: Map<string, number>
): DockStatusEventRecord[] => {
  const sortedSegments = [...seedSegments].sort(compareSeedSegmentsByDeparture);

  return sortedSegments.flatMap((segment, index) =>
    buildSeedEventsForSegment(segment, sortedSegments[index + 1]).map((event) =>
      overlayHistoryActual(event, historyActualsByEventKey.get(event.Key))
    )
  );
};

/**
 * Builds departure and arrival boundary records for one direct segment.
 *
 * @param segment - Direct seed segment
 * @param nextSegment - Next direct segment for the same vessel and sailing day
 * @returns Departure followed by arrival boundary records
 */
const buildSeedEventsForSegment = (
  segment: RawSeedSegment,
  nextSegment: RawSeedSegment | undefined
): [DockStatusEventRecord, DockStatusEventRecord] => {
  const scheduledArrival = resolveArrivalScheduledTimeWithTurnaround(
    segment,
    nextSegment
  );

  return [
    {
      SegmentKey: segment.Key,
      Key: buildBoundaryKey(segment.Key, "dep-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.DepartingTime,
      TerminalAbbrev: segment.DepartingTerminalAbbrev,
      NextTerminalAbbrev: segment.ArrivingTerminalAbbrev,
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
      NextTerminalAbbrev: segment.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventScheduledTime: scheduledArrival,
    },
  ];
};

/**
 * Resolves a segment arrival time with minimum same-terminal turn handling.
 *
 * WSF sometimes reports an arrival at a terminal and the same vessel departure
 * from that terminal at the exact same instant, especially on San Juan routes.
 * Reload models a minimum five-minute dock turn by shifting the arrival
 * boundary earlier so downstream timelines do not need one-off route fixes.
 *
 * @param segment - Direct seed segment whose arrival time is being resolved
 * @param nextSegment - Next direct segment for the same vessel and sailing day
 * @returns Scheduled arrival time, adjusted for same-terminal turnarounds
 */
const resolveArrivalScheduledTimeWithTurnaround = (
  segment: RawSeedSegment,
  nextSegment: RawSeedSegment | undefined
): number | undefined => {
  const scheduledArrival =
    segment.ArrivingTime ?? getOfficialScheduledArrivalTime(segment);

  return applyMinimumSameTerminalTurnaround(
    scheduledArrival,
    segment,
    nextSegment
  );
};

/**
 * Applies the minimum same-terminal turnaround policy when needed.
 *
 * @param scheduledArrival - Candidate arrival time in epoch milliseconds
 * @param segment - Direct seed segment that owns the arrival
 * @param nextSegment - Next direct segment for the same vessel and sailing day
 * @returns Original or adjusted arrival time
 */
const applyMinimumSameTerminalTurnaround = (
  scheduledArrival: number | undefined,
  segment: RawSeedSegment,
  nextSegment: RawSeedSegment | undefined
): number | undefined => {
  if (
    scheduledArrival !== undefined &&
    nextSegment !== undefined &&
    segment.ArrivingTerminalAbbrev === nextSegment.DepartingTerminalAbbrev &&
    scheduledArrival === nextSegment.DepartingTime
  ) {
    // Shift arrival earlier so identical same-terminal dep and arv stay ordered for the five-minute minimum turn.
    return scheduledArrival - MINIMUM_SAME_TERMINAL_TURNAROUND_MS;
  }

  return scheduledArrival;
};

/**
 * Resolves the schedule-implied arrival time when the segment lacks one.
 *
 * @param segment - Direct seed segment for one physical leg
 * @returns Scheduled arrival in epoch milliseconds, or undefined when unresolvable
 */
const getOfficialScheduledArrivalTime = (
  segment: RawSeedSegment
): number | undefined => {
  if (segment.RouteID === 9 && segment.ArrivingTime !== undefined) {
    return segment.ArrivingTime;
  }

  const duration = getOfficialCrossingTimeMinutes({
    routeAbbrev: segment.RouteAbbrev,
    departingTerminalAbbrev: segment.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
  });

  return duration === undefined
    ? undefined
    : segment.DepartingTime + duration * 60 * 1000;
};

/**
 * Overlays a history-derived actual time onto a seeded boundary record.
 *
 * @param event - Boundary record built from the seed segment
 * @param historyActualTime - Observed instant from history, when matched to this key
 * @returns Original event when no history matched, otherwise a copy carrying the actual
 */
const overlayHistoryActual = (
  event: DockStatusEventRecord,
  historyActualTime: number | undefined
): DockStatusEventRecord => {
  if (historyActualTime === undefined) {
    return event;
  }

  return {
    ...event,
    EventOccurred: true,
    EventActualTime: historyActualTime,
    EventPredictedTime: undefined,
  };
};

/**
 * Compares direct seed segments by scheduled departure time.
 *
 * @param left - First direct seed segment
 * @param right - Second direct seed segment
 * @returns Numeric sort result by departing time
 */
const compareSeedSegmentsByDeparture = (
  left: RawSeedSegment,
  right: RawSeedSegment
): number => left.DepartingTime - right.DepartingTime;

/**
 * Builds the grouping key for a seed segment vessel and sailing day.
 *
 * @param segment - Direct seed segment
 * @returns Composite vessel-day key
 */
const toVesselDayKey = (
  segment: Pick<RawSeedSegment, "VesselAbbrev" | "SailingDay">
) => `${segment.VesselAbbrev}:${segment.SailingDay}`;

export { buildReloadBoundaryEvents };
