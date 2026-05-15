/**
 * Builds vessel-scoped scheduled boundaries from direct physical seed segments.
 *
 * Reload persists a full sailing day at once; this module groups seeds by vessel
 * and sailing day. Each direct segment emits one departure and one arrival
 * boundary. Same-terminal turnaround policy lives here so scheduled and actual
 * projections share the same boundary timing without carrying actual evidence.
 */

import { buildBoundaryKey } from "shared/keys";
import { getOfficialCrossingTimeMinutes } from "../../../scheduledTrips";
import type { RawSeedSegment, ReloadScheduledBoundary } from "../types";

const MINIMUM_SAME_TERMINAL_TURNAROUND_MS = 5 * 60 * 1000;

/**
 * Builds scheduled boundaries for one reload batch from resolved direct seeds.
 *
 * The outer reload mutation replaces a whole sailing day, but this helper
 * groups direct seed segments by vessel and sailing day before emitting rows.
 * That keeps same-vessel continuity decisions, including minimum dock
 * turnaround handling, local to the boundary stage where they stay consistent
 * for both scheduled projection and actual synthesis without mixing in actual
 * event evidence.
 *
 * @param seedSegments - Direct seed segments for the reload batch
 * @returns Scheduled boundary records grouped by vessel day
 */
const buildReloadBoundaryEvents = ({
  seedSegments,
}: {
  seedSegments: RawSeedSegment[];
}): ReloadScheduledBoundary[] =>
  [...groupSeedSegmentsByVesselDay(seedSegments).values()].flatMap(
    (vesselDaySegments) => buildBoundaryEventsForVesselDay(vesselDaySegments)
  );

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
 * Builds scheduled boundary records for one vessel and sailing day.
 *
 * @param seedSegments - Direct seed segments sharing a vessel and sailing day
 * @returns Departure and arrival records in scheduled departure order
 */
const buildBoundaryEventsForVesselDay = (
  seedSegments: RawSeedSegment[]
): ReloadScheduledBoundary[] => {
  const sortedSegments = [...seedSegments].sort(compareSeedSegmentsByDeparture);

  return sortedSegments.flatMap((segment, index) =>
    buildSeedEventsForSegment(segment, sortedSegments[index + 1])
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
): [ReloadScheduledBoundary, ReloadScheduledBoundary] => {
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
