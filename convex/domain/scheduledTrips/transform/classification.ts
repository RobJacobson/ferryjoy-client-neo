import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import { groupTripsByPhysicalDeparture, groupTripsByVessel } from "../grouping";

/**
 * Classifies trips as direct or indirect using a chronological physical departure scan.
 * For multi-stage vessel trips, WSF API reports multiple destination options from the same
 * departure point. This function scans chronologically and uses lookahead to identify
 * which destination matches the vessel's actual next departure terminal.
 *
 * @param trips - Array of scheduled trip records to classify
 * @returns Array of all trips with TripType field set to "direct" or "indirect"
 */
export const classifyTripsByType = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  const tripsByVessel = groupTripsByVessel(trips);
  return Object.values(tripsByVessel).flatMap(processVesselTrips);
};

/**
 * Processes a single vessel's trips, classifying them as direct or indirect.
 *
 * @param vesselTrips - Array of trips for a single vessel
 * @returns Array of all trips with TripType field set to "direct" or "indirect"
 */
const processVesselTrips = (
  vesselTrips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  if (vesselTrips.length === 0) return [];

  // Sort chronologically by departure time
  vesselTrips.sort((a, b) => a.DepartingTime - b.DepartingTime);

  const groups = groupTripsByPhysicalDeparture(vesselTrips);
  const classifiedTrips: ConvexScheduledTrip[] = [];

  for (let i = 0; i < groups.length; i++) {
    const { trips, departingTime } = groups[i];
    const nextTerminal = groups[i + 1]?.departingTerminal;

    const resolved = resolveOverlappingGroup(
      trips,
      nextTerminal,
      trips[0].VesselAbbrev,
      departingTime
    );
    classifiedTrips.push(...resolved);
  }

  return classifiedTrips;
};

/**
 * Resolves overlapping trips by classifying which one leads to the expected next terminal.
 * Marks the trip matching the next terminal as "direct" and others as "indirect".
 *
 * @param overlappingTrips - Array of trips that depart at the same time
 * @param nextTerminal - Expected next departure terminal
 * @param vesselAbbrev - Vessel abbreviation for logging
 * @param departureTime - Departure time for logging
 * @returns Array of all trips with TripType field set to "direct" or "indirect"
 */
const resolveOverlappingGroup = (
  overlappingTrips: ConvexScheduledTrip[],
  nextTerminal: string | undefined,
  vesselAbbrev: string,
  departureTime: number
): ConvexScheduledTrip[] => {
  if (!nextTerminal) {
    // End of vessel's schedule - mark all as direct
    return overlappingTrips.map((trip) => ({
      ...trip,
      TripType: "direct" as const,
    }));
  }

  // Find the trip that goes to the next departure terminal
  const correctTrip = overlappingTrips.find(
    (trip) => trip.ArrivingTerminalAbbrev === nextTerminal
  );

  if (correctTrip) {
    return overlappingTrips.map((trip) => ({
      ...trip,
      TripType:
        trip.ArrivingTerminalAbbrev === nextTerminal
          ? ("direct" as const)
          : ("indirect" as const),
    }));
  }

  // Fallback: no trip matches expected next terminal
  console.warn(
    `No overlapping trip goes to expected next terminal ${nextTerminal} ` +
      `for vessel ${vesselAbbrev} departing at ${new Date(departureTime).toISOString()}`
  );
  return overlappingTrips.map((trip) => ({
    ...trip,
    TripType: "direct" as const,
  }));
};
