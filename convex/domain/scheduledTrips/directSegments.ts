import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import {
  groupTripsByPhysicalDeparture,
  groupTripsByVessel,
  type PhysicalDeparture,
} from "./grouping";

/**
 * Classifies raw schedule rows into direct/indirect rows using only
 * physical-departure grouping and next-terminal lookahead.
 */
export const classifyDirectSegments = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  const tripsByVessel = groupTripsByVessel(trips);

  return Object.values(tripsByVessel).flatMap((vesselTrips) => {
    const sortedTrips = [...vesselTrips].sort(
      (a, b) => a.DepartingTime - b.DepartingTime
    );
    const groups = groupTripsByPhysicalDeparture(sortedTrips);

    return groups.flatMap((group, index) => {
      const nextTerminal = groups[index + 1]?.departingTerminal;
      return classifyDepartureGroup(group, nextTerminal);
    });
  });
};

/**
 * Returns only the direct physical segments from a raw schedule set.
 */
export const getDirectSegments = (trips: ConvexScheduledTrip[]) =>
  classifyDirectSegments(trips).filter((trip) => trip.TripType === "direct");

const classifyDepartureGroup = (
  { trips }: PhysicalDeparture,
  nextTerminal: string | undefined
): ConvexScheduledTrip[] => {
  if (!nextTerminal) {
    return trips.map((trip) => ({ ...trip, TripType: "direct" as const }));
  }

  const directMatch = trips.find(
    (trip) => trip.ArrivingTerminalAbbrev === nextTerminal
  );
  const directKey = directMatch?.Key;

  return trips.map((trip) => ({
    ...trip,
    TripType:
      !directMatch || trip.ArrivingTerminalAbbrev === nextTerminal
        ? ("direct" as const)
        : ("indirect" as const),
    DirectKey: directKey,
  }));
};
