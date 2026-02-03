import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";

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
 * Reconstructs scheduled journeys from a set of raw trips.
 * Groups trips by physical departure and follows chains to build complete timelines.
 *
 * @param params - Reconstruction parameters
 * @param params.startingTrips - Trips that start at the requested terminal
 * @param params.allVesselTrips - All trips for the vessels involved (for chain building)
 * @param params.destinationAbbrev - Optional filter for a specific destination
 * @returns Array of reconstructed journeys
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
  const physicalDepartures = groupStartingTrips(startingTrips);

  return Array.from(physicalDepartures.values())
    .map((group) =>
      buildJourneyFromGroup({ group, destinationAbbrev, tripsByKey })
    )
    .filter((j): j is ScheduledJourney => j !== null)
    .sort((a, b) => a.departureTime - b.departureTime);
};

/**
 * Groups starting trips by their physical departure (Vessel + Time).
 */
const groupStartingTrips = (trips: ConvexScheduledTrip[]) =>
  trips.reduce((acc, trip) => {
    const key = `${trip.VesselAbbrev}|${trip.DepartingTime}`;
    const group = acc.get(key) ?? [];
    group.push(trip);
    acc.set(key, group);
    return acc;
  }, new Map<string, ConvexScheduledTrip[]>());

/**
 * Builds a single journey from a group of trips sharing a physical departure.
 */
const buildJourneyFromGroup = ({
  group,
  destinationAbbrev,
  tripsByKey,
}: {
  group: ConvexScheduledTrip[];
  destinationAbbrev?: string;
  tripsByKey: Map<string, ConvexScheduledTrip>;
}): ScheduledJourney | null => {
  const targetTrip = findTargetTrip(group, destinationAbbrev);
  if (!targetTrip) return null;

  const directStart = group.find((t) => t.TripType === "direct") || targetTrip;
  const physicalSegments = buildPhysicalChain(
    directStart,
    targetTrip.ArrivingTerminalAbbrev,
    tripsByKey
  );

  return {
    id: targetTrip.Key,
    vesselAbbrev: targetTrip.VesselAbbrev,
    routeAbbrev: targetTrip.RouteAbbrev,
    departureTime: targetTrip.DepartingTime,
    segments: formatSegments(physicalSegments),
  };
};

/**
 * Finds the representative trip for a physical departure group.
 */
const findTargetTrip = (
  group: ConvexScheduledTrip[],
  destinationAbbrev?: string
): ConvexScheduledTrip | undefined => {
  if (destinationAbbrev) {
    return group.find((t) => t.ArrivingTerminalAbbrev === destinationAbbrev);
  }

  // Pick furthest destination: prefer indirect over direct, then latest arrival
  return [...group].sort((a, b) => {
    if (a.TripType === "indirect" && b.TripType === "direct") return -1;
    if (a.TripType === "direct" && b.TripType === "indirect") return 1;
    return (b.ArrivingTime ?? 0) - (a.ArrivingTime ?? 0);
  })[0];
};

/**
 * Reconstructs a physical vessel chain by following NextKey pointers.
 */
const buildPhysicalChain = (
  start: ConvexScheduledTrip,
  targetArrivalTerminal: string,
  tripsByKey: Map<string, ConvexScheduledTrip>
): ConvexScheduledTrip[] => {
  const segments: ConvexScheduledTrip[] = [];
  const visitedKeys = new Set<string>();
  let current: ConvexScheduledTrip | undefined = start;

  while (current) {
    if (visitedKeys.has(current.Key)) break;
    visitedKeys.add(current.Key);
    segments.push(current);

    if (current.ArrivingTerminalAbbrev === targetArrivalTerminal) break;

    const nextKey: string | undefined = current.NextKey;
    current = nextKey ? tripsByKey.get(nextKey) : undefined;
  }

  return segments;
};

/**
 * Formats physical segments for UI display (mapping intermediate stop times).
 */
const formatSegments = (segments: ConvexScheduledTrip[]) =>
  segments.map((s, idx) => {
    const next = segments[idx + 1];
    return {
      ...s,
      DisplayArrivingTerminalAbbrev: next
        ? next.DepartingTerminalAbbrev
        : s.ArrivingTerminalAbbrev,
      SchedArriveNext: next ? next.SchedArriveCurr : s.SchedArriveNext,
    };
  });
