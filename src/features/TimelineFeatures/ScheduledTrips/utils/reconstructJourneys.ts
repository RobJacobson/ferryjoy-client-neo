/**
 * Reconstructs scheduled journeys from flat domain segments (client-side).
 * Groups by physical departure, builds chains via NextKey, filters by destination.
 */

import type { ScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import type { ScheduledTripJourney } from "../types";

// Domain segment shape used for chain building (must have NextKey and Date times).
type SegmentWithNextKey = ScheduledTrip;

type PhysicalDeparture = {
  departingTerminal: string;
  departingTimeMs: number;
  vesselAbbrev: string;
  trips: SegmentWithNextKey[];
};

/**
 * Groups a vessel's segments by physical departure (terminal + time).
 *
 * @param vesselTrips - Chronologically sorted segments for a single vessel
 * @returns Array of PhysicalDeparture groups
 */
const groupByPhysicalDeparture = (
  vesselTrips: SegmentWithNextKey[]
): PhysicalDeparture[] => {
  if (vesselTrips.length === 0) return [];

  return vesselTrips.reduce((groups, trip) => {
    const lastGroup = groups[groups.length - 1];
    const timeMs = trip.DepartingTime.getTime();

    if (
      lastGroup &&
      lastGroup.departingTerminal === trip.DepartingTerminalAbbrev &&
      lastGroup.departingTimeMs === timeMs
    ) {
      lastGroup.trips.push(trip);
    } else {
      groups.push({
        departingTerminal: trip.DepartingTerminalAbbrev,
        departingTimeMs: timeMs,
        vesselAbbrev: trip.VesselAbbrev,
        trips: [trip],
      });
    }
    return groups;
  }, [] as PhysicalDeparture[]);
};

const buildPhysicalChain = (
  start: SegmentWithNextKey,
  targetTerminal: string,
  byKey: Map<string, SegmentWithNextKey>
): SegmentWithNextKey[] => {
  const segments: SegmentWithNextKey[] = [];
  let current: SegmentWithNextKey | undefined = start;

  while (current && !segments.some((s) => s.Key === current?.Key)) {
    segments.push(current);
    if (current.ArrivingTerminalAbbrev === targetTerminal) break;
    current = current.NextKey ? byKey.get(current.NextKey) : undefined;
  }

  return segments;
};

const findTargetTrip = (
  group: SegmentWithNextKey[],
  destinationAbbrev?: string
): SegmentWithNextKey | undefined => {
  if (destinationAbbrev) {
    return group.find((t) => t.ArrivingTerminalAbbrev === destinationAbbrev);
  }
  return [...group].sort((a, b) => {
    const aVal = a.TripType === "indirect" ? 1 : 0;
    const bVal = b.TripType === "indirect" ? 1 : 0;
    return (
      bVal - aVal ||
      (b.ArrivingTime?.getTime() ?? 0) - (a.ArrivingTime?.getTime() ?? 0)
    );
  })[0];
};

/** Format segments for UI: add DisplayArrivingTerminalAbbrev and SchedArriveNext from next segment. */
const formatSegments = (
  segments: SegmentWithNextKey[]
): ScheduledTripJourney["segments"] =>
  segments.map((s, idx) => {
    const next = segments[idx + 1];
    return {
      ...s,
      DisplayArrivingTerminalAbbrev:
        next?.DepartingTerminalAbbrev ?? s.ArrivingTerminalAbbrev,
      SchedArriveNext: next?.SchedArriveCurr ?? s.SchedArriveNext,
    };
  });

const buildJourney = (
  group: SegmentWithNextKey[],
  destinationAbbrev: string | undefined,
  byKey: Map<string, SegmentWithNextKey>
): ScheduledTripJourney | null => {
  const target = findTargetTrip(group, destinationAbbrev);
  if (!target) return null;

  const startSegment = group.find((t) => t.TripType === "direct") || target;
  const chain = buildPhysicalChain(
    startSegment,
    target.ArrivingTerminalAbbrev,
    byKey
  );

  return {
    id: target.Key,
    vesselAbbrev: target.VesselAbbrev,
    routeAbbrev: target.RouteAbbrev,
    departureTime: target.DepartingTime.getTime(),
    segments: formatSegments(chain),
  };
};

/**
 * Reconstructs journeys from flat domain segments (client-side).
 * Call after mapping query result with toDomainScheduledTrip.
 *
 * @param flatSegments - All domain segments for vessels that depart from the terminal that day
 * @param terminalAbbrev - Page departure terminal (starting trips filter)
 * @param destinationAbbrev - Optional destination filter
 * @returns Sorted array of ScheduledTripJourney
 */
export const reconstructJourneys = (
  flatSegments: SegmentWithNextKey[],
  terminalAbbrev: string,
  destinationAbbrev?: string
): ScheduledTripJourney[] => {
  const byKey = new Map(flatSegments.map((t) => [t.Key, t]));

  const startingTrips = flatSegments
    .filter((t) => t.DepartingTerminalAbbrev === terminalAbbrev)
    .sort((a, b) => a.DepartingTime.getTime() - b.DepartingTime.getTime());

  const groups = groupByPhysicalDeparture(startingTrips);

  return groups
    .map((group) => buildJourney(group.trips, destinationAbbrev, byKey))
    .filter((j): j is ScheduledTripJourney => j !== null)
    .sort((a, b) => a.departureTime - b.departureTime);
};
