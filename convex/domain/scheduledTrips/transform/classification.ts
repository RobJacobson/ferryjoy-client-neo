/**
 * Logic for distinguishing Direct vs. Indirect trips.
 * A "Direct" trip is the immediate next stop for a vessel.
 *
 * @module
 */

import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import {
  groupTripsByPhysicalDeparture,
  groupTripsByVessel,
  type PhysicalDeparture,
} from "../grouping";

/**
 * Classifies trips as direct or indirect using a chronological physical departure scan.
 * Multi-destination departures are resolved by looking ahead at the vessel's next stop.
 *
 * @param trips - Array of scheduled trip records to classify
 * @returns Array of all trips with TripType field set to "direct" or "indirect"
 */
export const classifyTripsByType = (
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
      return resolveOverlappingGroup(group, nextTerminal);
    });
  });
};

/**
 * Resolves overlapping trips by classifying which one leads to the expected next terminal.
 *
 * @param group - Physical departure group
 * @param nextTerminal - Expected next departure terminal
 * @returns Array of trips with TripType set
 */
const resolveOverlappingGroup = (
  { trips, vesselAbbrev, departingTime }: PhysicalDeparture,
  nextTerminal: string | undefined
): ConvexScheduledTrip[] => {
  // End of vessel's schedule or no lookahead possible - mark all as direct
  if (!nextTerminal) {
    return trips.map((trip) => ({ ...trip, TripType: "direct" }));
  }

  const directMatch = trips.find(
    (trip) => trip.ArrivingTerminalAbbrev === nextTerminal
  );

  if (!directMatch) {
    console.warn(
      `[CLASSIFY] No trip matches next terminal ${nextTerminal} for ${vesselAbbrev} at ${new Date(departingTime).toISOString()}`
    );
  }

  const directKey = directMatch?.Key;

  return trips.map((trip) => ({
    ...trip,
    TripType:
      !directMatch || trip.ArrivingTerminalAbbrev === nextTerminal
        ? "direct"
        : "indirect",
    DirectKey: directKey,
  }));
};
