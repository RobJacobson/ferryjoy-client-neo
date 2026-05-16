/**
 * Build scheduled dock boundaries from direct seed legs.
 *
 * Each seed leg contributes a departure and arrival boundary. Vessel-day
 * ordering lives here because same-terminal turn handling depends on the next
 * physical leg for that vessel.
 */

import { groupBy } from "shared/groupBy";
import { buildBoundaryKey } from "shared/keys";
import { getOfficialCrossingTimeMinutes } from "../../scheduledTrips";
import type { ScheduledBoundary, SeedLeg } from "./types";

const MINIMUM_SAME_TERMINAL_TURNAROUND_MS = 5 * 60 * 1000;

/**
 * Builds scheduled dock boundaries from direct seed legs.
 *
 * Boundaries stay schedule-only: they carry segment identity, terminals, event
 * type, and scheduled boundary times, while actual row candidates are resolved
 * later by actual-row assembly.
 *
 * @param seedLegs - Direct physical legs resolved from the WSF schedule
 * @returns Departure and arrival boundaries ordered within each vessel day
 */
const buildScheduledBoundaries = (seedLegs: SeedLeg[]): ScheduledBoundary[] =>
  [...groupBy(seedLegs, toVesselDayKey).values()].flatMap((vesselDayLegs) =>
    [...vesselDayLegs]
      .sort(compareByDeparture)
      .flatMap((leg, index, sortedLegs) =>
        buildBoundariesForLeg(leg, sortedLegs[index + 1])
      )
  );

/**
 * Builds the two dock boundaries for one seed leg.
 *
 * @param leg - Direct physical seed leg
 * @param nextLeg - Next seed leg for the same vessel day
 * @returns Departure and arrival scheduled boundaries
 */
const buildBoundariesForLeg = (
  leg: SeedLeg,
  nextLeg: SeedLeg | undefined
): [ScheduledBoundary, ScheduledBoundary] => [
  {
    SegmentKey: leg.Key,
    Key: buildBoundaryKey(leg.Key, "dep-dock"),
    VesselAbbrev: leg.VesselAbbrev,
    SailingDay: leg.SailingDay,
    ScheduledDeparture: leg.DepartingTime,
    TerminalAbbrev: leg.DepartingTerminalAbbrev,
    NextTerminalAbbrev: leg.ArrivingTerminalAbbrev,
    EventType: "dep-dock",
    EventScheduledTime: leg.DepartingTime,
  },
  {
    SegmentKey: leg.Key,
    Key: buildBoundaryKey(leg.Key, "arv-dock"),
    VesselAbbrev: leg.VesselAbbrev,
    SailingDay: leg.SailingDay,
    ScheduledDeparture: leg.DepartingTime,
    TerminalAbbrev: leg.ArrivingTerminalAbbrev,
    NextTerminalAbbrev: leg.ArrivingTerminalAbbrev,
    EventType: "arv-dock",
    EventScheduledTime: resolveArrivalScheduledTime(leg, nextLeg),
  },
];

/**
 * Resolves the scheduled arrival boundary time for one leg.
 *
 * Same-terminal turnarounds need a minimum gap so departure and arrival
 * boundaries stay ordered for downstream timeline consumers.
 *
 * @param leg - Seed leg whose arrival boundary is being resolved
 * @param nextLeg - Next seed leg for the same vessel day
 * @returns Scheduled arrival boundary time when available
 */
const resolveArrivalScheduledTime = (
  leg: SeedLeg,
  nextLeg: SeedLeg | undefined
): number | undefined =>
  applySameTerminalTurnaround(
    leg.ArrivingTime ?? getOfficialScheduledArrivalTime(leg),
    leg,
    nextLeg
  );

/**
 * Applies the minimum same-terminal turnaround policy.
 *
 * @param scheduledArrival - Candidate arrival boundary time
 * @param leg - Seed leg that owns the arrival
 * @param nextLeg - Next seed leg for the same vessel day
 * @returns Original or adjusted arrival boundary time
 */
const applySameTerminalTurnaround = (
  scheduledArrival: number | undefined,
  leg: SeedLeg,
  nextLeg: SeedLeg | undefined
): number | undefined =>
  scheduledArrival !== undefined &&
  nextLeg !== undefined &&
  leg.ArrivingTerminalAbbrev === nextLeg.DepartingTerminalAbbrev &&
  scheduledArrival === nextLeg.DepartingTime
    ? scheduledArrival - MINIMUM_SAME_TERMINAL_TURNAROUND_MS
    : scheduledArrival;

/**
 * Computes a schedule-implied arrival time when WSF omits one.
 *
 * @param leg - Seed leg whose route duration is needed
 * @returns Scheduled arrival time or undefined when no route duration is known
 */
const getOfficialScheduledArrivalTime = (leg: SeedLeg): number | undefined => {
  const duration = getOfficialCrossingTimeMinutes({
    routeAbbrev: leg.RouteAbbrev,
    departingTerminalAbbrev: leg.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: leg.ArrivingTerminalAbbrev,
  });
  const officialScheduledArrival =
    duration === undefined
      ? undefined
      : leg.DepartingTime + duration * 60 * 1000;

  return officialScheduledArrival;
};

/**
 * Builds the vessel-day grouping key for a seed leg.
 *
 * @param leg - Seed leg with vessel and sailing-day identity
 * @returns Composite vessel-day key
 */
const toVesselDayKey = (leg: Pick<SeedLeg, "VesselAbbrev" | "SailingDay">) =>
  `${leg.VesselAbbrev}:${leg.SailingDay}`;

/**
 * Compares seed legs by scheduled departure.
 *
 * @param left - First seed leg
 * @param right - Second seed leg
 * @returns Numeric sort result
 */
const compareByDeparture = (left: SeedLeg, right: SeedLeg): number =>
  left.DepartingTime - right.DepartingTime;

export { buildScheduledBoundaries };
