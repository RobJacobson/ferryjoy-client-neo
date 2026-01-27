/**
 * Trip classification (direct vs indirect).
 *
 * Ported from `convex/functions/scheduledTrips/sync/businessLogic.ts`.
 * Operates on ms-based scheduled trips.
 */

import type { ScheduledTripMs } from "./types";

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Classify trips as direct or indirect using a two-pointer chronological scan.
 *
 * @param trips - Scheduled trips (ms timestamps)
 * @returns Trips with `TripType` set
 */
export const classifyTripsByType = (trips: ScheduledTripMs[]): ScheduledTripMs[] => {
  const tripsByVessel = groupTripsByVessel(trips);
  return Object.values(tripsByVessel).flatMap(processVesselTrips);
};

// ============================================================================
// INTERNAL HELPERS (ported)
// ============================================================================

/**
 * Group trips by vessel abbreviation for chronological processing.
 *
 * @param trips - Array of scheduled trips
 * @returns Map of vesselAbbrev → trips
 */
const groupTripsByVessel = (
  trips: ScheduledTripMs[]
): Record<string, ScheduledTripMs[]> => {
  return trips.reduce(
    (acc, trip) => {
      acc[trip.VesselAbbrev] ??= [];
      acc[trip.VesselAbbrev].push(trip);
      return acc;
    },
    {} as Record<string, ScheduledTripMs[]>
  );
};

/**
 * Process a single vessel's trips chronologically, classifying them as direct/indirect.
 *
 * @param vesselTrips - Trips for a single vessel
 * @returns Classified trips
 */
const processVesselTrips = (vesselTrips: ScheduledTripMs[]): ScheduledTripMs[] => {
  if (vesselTrips.length === 0) return [];

  vesselTrips.sort((a, b) => a.DepartingTime - b.DepartingTime);

  const classifiedTrips: ScheduledTripMs[] = [];
  let i = 0;

  while (i < vesselTrips.length) {
    const overlappingTrips = findOverlappingGroup(vesselTrips, i);

    if (overlappingTrips.length === 1) {
      const trip = overlappingTrips[0];
      if (!trip) break;
      classifiedTrips.push({
        ...trip,
        TripType: "direct",
      });
      i += 1;
      continue;
    }

    const reference = overlappingTrips[0];
    if (!reference) break;

    const nextTerminal = findNextDepartureTerminal(
      vesselTrips,
      i + overlappingTrips.length,
      reference.DepartingTime
    );

    const resolvedTrips = resolveOverlappingGroup(
      overlappingTrips,
      nextTerminal,
      reference.VesselAbbrev,
      reference.DepartingTime
    );

    classifiedTrips.push(...resolvedTrips);
    i += overlappingTrips.length;
  }

  return classifiedTrips;
};

/**
 * Find the next departure terminal for this vessel after an overlap group.
 *
 * @param vesselTrips - All trips for the vessel
 * @param afterIndex - Index to start scanning from
 * @param currentDepartureTime - Departure time to skip
 * @returns Next departure terminal abbrev, or undefined
 */
const findNextDepartureTerminal = (
  vesselTrips: ScheduledTripMs[],
  afterIndex: number,
  currentDepartureTime: number
): string | undefined => {
  return vesselTrips
    .slice(afterIndex)
    .find((trip) => trip.DepartingTime !== currentDepartureTime)
    ?.DepartingTerminalAbbrev;
};

/**
 * Find all trips that depart at the same time from the same terminal.
 *
 * @param vesselTrips - All trips for the vessel
 * @param startIndex - Index to start scanning from
 * @returns Overlap group
 */
const findOverlappingGroup = (
  vesselTrips: ScheduledTripMs[],
  startIndex: number
): ScheduledTripMs[] => {
  if (startIndex >= vesselTrips.length) return [];

  const referenceTrip = vesselTrips[startIndex];
  if (!referenceTrip) return [];

  return vesselTrips
    .slice(startIndex)
    .filter(
      (trip) =>
        trip.DepartingTime === referenceTrip.DepartingTime &&
        trip.DepartingTerminalAbbrev === referenceTrip.DepartingTerminalAbbrev
    );
};

/**
 * Resolve overlap group by checking which arrival matches the next departure terminal.
 *
 * @param overlappingTrips - Trips that share departure time + departing terminal
 * @param nextTerminal - Expected next departure terminal
 * @param vesselAbbrev - Vessel abbrev (for logging)
 * @param departureTime - Departure time (for logging)
 * @returns Trips with TripType assigned
 */
const resolveOverlappingGroup = (
  overlappingTrips: ScheduledTripMs[],
  nextTerminal: string | undefined,
  vesselAbbrev: string,
  departureTime: number
): ScheduledTripMs[] => {
  if (!nextTerminal) {
    return overlappingTrips.map((trip) => ({
      ...trip,
      TripType: "direct" as const,
    }));
  }

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

  console.warn(
    `No overlapping trip goes to expected next terminal ${nextTerminal} ` +
      `for vessel ${vesselAbbrev} departing at ${new Date(departureTime).toISOString()}`
  );

  return overlappingTrips.map((trip) => ({
    ...trip,
    TripType: "direct" as const,
  }));
};

