import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";

/**
 * Groups trips by vessel abbreviation for chronological processing.
 */
export const groupTripsByVessel = (
  trips: ConvexScheduledTrip[]
): Record<string, ConvexScheduledTrip[]> => {
  return trips.reduce(
    (acc, trip) => {
      acc[trip.VesselAbbrev] ??= [];
      acc[trip.VesselAbbrev].push(trip);
      return acc;
    },
    {} as Record<string, ConvexScheduledTrip[]>
  );
};

/**
 * Groups a vessel's trips by their physical departure (terminal and time).
 * This handles the "San Juan Problem" where one physical departure has multiple destinations.
 */
export const groupTripsByPhysicalDeparture = (
  vesselTrips: ConvexScheduledTrip[]
) => {
  const groups: {
    departingTerminal: string;
    departingTime: number;
    trips: ConvexScheduledTrip[];
  }[] = [];

  for (const trip of vesselTrips) {
    const lastGroup = groups[groups.length - 1];
    if (
      lastGroup &&
      lastGroup.departingTerminal === trip.DepartingTerminalAbbrev &&
      lastGroup.departingTime === trip.DepartingTime
    ) {
      lastGroup.trips.push(trip);
    } else {
      groups.push({
        departingTerminal: trip.DepartingTerminalAbbrev,
        departingTime: trip.DepartingTime,
        trips: [trip],
      });
    }
  }

  return groups;
};
