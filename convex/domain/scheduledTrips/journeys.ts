/**
 * Logic for reconstructing physical vessel journeys from individual segments.
 *
 * @module
 */

import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import { groupTripsByPhysicalDeparture } from "./grouping";

/**
 * Represents a reconstructed journey consisting of multiple physical segments.
 */
export type ScheduledJourney = {
  id: string;
  vesselAbbrev: string;
  routeAbbrev: string;
  departureTime: number;
  segments: Array<
    ConvexScheduledTrip & {
      DisplayArrivingTerminalAbbrev: string;
      SchedArriveNext?: number;
    }
  >;
};

/**
 * Reconstructs scheduled journeys from a set of starting trips.
 *
 * @param params - Reconstruction parameters
 * @param params.startingTrips - Trips departing from the requested terminal
 * @param params.allVesselTrips - All trips for involved vessels (for chain building)
 * @param params.destinationAbbrev - Optional destination filter
 * @returns Sorted array of reconstructed journeys
 */
export const reconstructJourneys = ({
  startingTrips,
  allVesselTrips,
  destinationAbbrev,
}: {
  startingTrips: ConvexScheduledTrip[];
  allVesselTrips: ConvexScheduledTrip[];
  destinationAbbrev?: string;
}): ScheduledJourney[] => {
  const tripsByKey = new Map(allVesselTrips.map((t) => [t.Key, t]));

  // Group starting trips by physical departure
  const sortedStarting = [...startingTrips].sort(
    (a, b) => a.DepartingTime - b.DepartingTime
  );
  const groups = groupTripsByPhysicalDeparture(sortedStarting);

  return groups
    .map((group) => buildJourney(group.trips, destinationAbbrev, tripsByKey))
    .filter((j): j is ScheduledJourney => j !== null)
    .sort((a, b) => a.departureTime - b.departureTime);
};

/**
 * Builds a single journey from a physical departure group.
 */
const buildJourney = (
  group: ConvexScheduledTrip[],
  destinationAbbrev: string | undefined,
  tripsByKey: Map<string, ConvexScheduledTrip>
): ScheduledJourney | null => {
  const target = findTargetTrip(group, destinationAbbrev);
  if (!target) return null;

  // Start the physical chain from the direct segment of this departure
  const startSegment = group.find((t) => t.TripType === "direct") || target;
  const chain = buildPhysicalChain(
    startSegment,
    target.ArrivingTerminalAbbrev,
    tripsByKey
  );

  return {
    id: target.Key,
    vesselAbbrev: target.VesselAbbrev,
    routeAbbrev: target.RouteAbbrev,
    departureTime: target.DepartingTime,
    segments: formatSegments(chain),
  };
};

/**
 * Picks the representative trip for a group (furthest destination if no filter).
 */
const findTargetTrip = (
  group: ConvexScheduledTrip[],
  destinationAbbrev?: string
) => {
  if (destinationAbbrev) {
    return group.find((t) => t.ArrivingTerminalAbbrev === destinationAbbrev);
  }

  // Prefer indirect (furthest) over direct, then latest arrival
  return [...group].sort((a, b) => {
    const aVal = a.TripType === "indirect" ? 1 : 0;
    const bVal = b.TripType === "indirect" ? 1 : 0;
    return bVal - aVal || (b.ArrivingTime ?? 0) - (a.ArrivingTime ?? 0);
  })[0];
};

/**
 * Follows NextKey pointers to reconstruct the physical vessel path.
 */
const buildPhysicalChain = (
  start: ConvexScheduledTrip,
  targetTerminal: string,
  tripsByKey: Map<string, ConvexScheduledTrip>
): ConvexScheduledTrip[] => {
  const segments: ConvexScheduledTrip[] = [];
  let current: ConvexScheduledTrip | undefined = start;

  while (current && !segments.some((s) => s.Key === current?.Key)) {
    segments.push(current);
    if (current.ArrivingTerminalAbbrev === targetTerminal) break;
    current = current.NextKey ? tripsByKey.get(current.NextKey) : undefined;
  }

  return segments;
};

/**
 * Formats segments for UI, mapping intermediate stop times.
 */
const formatSegments = (segments: ConvexScheduledTrip[]) =>
  segments.map((s, idx) => {
    const next = segments[idx + 1];
    return {
      ...s,
      DisplayArrivingTerminalAbbrev:
        next?.DepartingTerminalAbbrev ?? s.ArrivingTerminalAbbrev,
      SchedArriveNext: next?.SchedArriveCurr ?? s.SchedArriveNext,
    };
  });
