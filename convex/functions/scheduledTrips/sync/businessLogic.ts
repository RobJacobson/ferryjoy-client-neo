import {
  config,
  formatTerminalPairKey,
} from "../../../domain/ml/shared/config";
import { roundUpToNextMinute } from "../../../shared/durationUtils";
import type { ConvexScheduledTrip } from "../schemas";

/**
 * Filters out indirect/overlapping trips using a two-pointer chronological scan.
 * For multi-stage vessel trips, WSF API reports multiple destination options from the same
 * departure point. This function scans chronologically and uses lookahead to identify
 * which destination matches the vessel's actual next departure terminal.
 *
 * Algorithm:
 * 1. Group trips by vessel and sailing day, sort chronologically
 * 2. Scan through trips with two pointers (current + lookahead)
 * 3. When overlapping departures found, check next trip's departure terminal
 * 4. Keep only trips where arrival terminal matches next departure terminal
 *
 *
 * @param trips - Array of scheduled trip records to filter
 * @returns Filtered array with chronologically correct trips only
 */
export const filterOverlappingTrips = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  // Group trips by vessel (across all routes and days for proper network traversal)
  const tripsByVessel = groupTripsByVessel(trips);

  return Object.values(tripsByVessel).flatMap(processVesselTrips);
};

/**
 * Groups trips by vessel abbreviation for chronological processing.
 *
 * @param trips - Array of scheduled trips to group
 * @returns Object mapping vessel abbreviations to arrays of their trips
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
 * Processes a single vessel's trips chronologically, resolving overlapping routes.
 *
 * @param vesselTrips - Array of trips for a single vessel
 * @returns Array of filtered trips with overlapping routes resolved
 */
export const processVesselTrips = (
  vesselTrips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  if (vesselTrips.length === 0) return [];

  // Sort chronologically by departure time
  vesselTrips.sort((a, b) => a.DepartingTime - b.DepartingTime);

  const filteredTrips: ConvexScheduledTrip[] = [];
  let i = 0;

  while (i < vesselTrips.length) {
    const overlappingTrips = findOverlappingGroup(vesselTrips, i);

    if (overlappingTrips.length === 1) {
      // Single trip - keep it
      filteredTrips.push(overlappingTrips[0]);
      i += 1;
    } else {
      // Multiple overlapping trips - resolve using lookahead
      const nextTerminal = findNextDepartureTerminal(
        vesselTrips,
        i + overlappingTrips.length,
        overlappingTrips[0].DepartingTime
      );
      const resolvedTrips = resolveOverlappingGroup(
        overlappingTrips,
        nextTerminal,
        overlappingTrips[0].VesselAbbrev,
        overlappingTrips[0].DepartingTime
      );
      filteredTrips.push(...resolvedTrips);
      i += overlappingTrips.length;
    }
  }

  return filteredTrips;
};

/**
 * Scans forward from current position to find where this vessel departs from next.
 * This helps resolve which destination the vessel actually chose.
 *
 * @param vesselTrips - Array of trips for a single vessel
 * @param afterIndex - Index to start scanning from
 * @param currentDepartureTime - Current departure time to skip
 * @returns The next departure terminal abbreviation, or undefined if none found
 */
export const findNextDepartureTerminal = (
  vesselTrips: ConvexScheduledTrip[],
  afterIndex: number,
  currentDepartureTime: number
): string | undefined => {
  return vesselTrips
    .slice(afterIndex)
    .find((trip) => trip.DepartingTime !== currentDepartureTime)
    ?.DepartingTerminalAbbrev;
};

/**
 * Finds all trips that depart at the same time from the same terminal.
 * These represent overlapping/ambiguous route options.
 *
 * @param vesselTrips - Array of trips for a single vessel
 * @param startIndex - Index to start scanning from
 * @returns Array of trips that depart at the same time from the same terminal
 */
export const findOverlappingGroup = (
  vesselTrips: ConvexScheduledTrip[],
  startIndex: number
): ConvexScheduledTrip[] => {
  if (startIndex >= vesselTrips.length) return [];

  const referenceTrip = vesselTrips[startIndex];
  return vesselTrips
    .slice(startIndex)
    .filter(
      (trip) =>
        trip.DepartingTime === referenceTrip.DepartingTime &&
        trip.DepartingTerminalAbbrev === referenceTrip.DepartingTerminalAbbrev
    );
};

/**
 * Resolves overlapping trips by finding which one leads to the expected next terminal.
 * If no trip matches the expected terminal, falls back to keeping all options.
 *
 * @param overlappingTrips - Array of trips that depart at the same time
 * @param nextTerminal - Expected next departure terminal
 * @param vesselAbbrev - Vessel abbreviation for logging
 * @param departureTime - Departure time for logging
 * @returns Array of resolved trips (usually just one)
 */
export const resolveOverlappingGroup = (
  overlappingTrips: ConvexScheduledTrip[],
  nextTerminal: string | undefined,
  vesselAbbrev: string,
  departureTime: number
): ConvexScheduledTrip[] => {
  if (!nextTerminal) {
    // No next departure found (end of vessel's schedule) - keep all options
    return overlappingTrips;
  }

  // Keep only the trip that goes to the next departure terminal
  const correctTrip = overlappingTrips.find(
    (trip) => trip.ArrivingTerminalAbbrev === nextTerminal
  );

  if (correctTrip) {
    return [correctTrip];
  } else {
    // Fallback: no trip matches expected next terminal
    // This can happen with irregular schedules - keep all options
    console.warn(
      `No overlapping trip goes to expected next terminal ${nextTerminal} ` +
        `for vessel ${vesselAbbrev} departing at ${new Date(departureTime).toISOString()}`
    );
    return overlappingTrips;
  }
};

/**
 * Calculates PrevKey, NextKey, NextDepartingTime, EstArriveNext, and EstArriveCurr
 * for all trips.
 * Must be called after vessel-level filtering to ensure correct chronological order.
 *
 * @param trips - Array of scheduled trip records to enhance
 * @returns Array of trips with additional estimate fields populated
 */
export const calculateTripEstimates = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  const tripsByVessel = groupTripsByVessel(trips);

  return Object.values(tripsByVessel).flatMap(calculateVesselTripEstimates);
};

/**
 * Calculates estimates for a single vessel's chronologically sorted trips.
 *
 * Computes PrevKey, NextKey, NextDepartingTime, and validates EstArriveCurr
 * by linking consecutive trips in the vessel's journey.
 *
 * @param vesselTrips - Array of chronologically sorted trips for a single vessel
 * @returns Array of trips with calculated estimates (PrevKey, NextKey, etc.)
 */
const calculateVesselTripEstimates = (
  vesselTrips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  if (vesselTrips.length === 0) return [];

  // First pass: calculate EstArriveNext for all trips
  const tripsWithNextArrival = vesselTrips.map((trip) => ({
    ...trip,
    EstArriveNext: calculateEstArriveNext(trip),
  }));

  // Second pass: set PrevKey/NextKey/NextDepartingTime and validate EstArriveCurr
  return tripsWithNextArrival.map((trip, index) => {
    const nextTrip = tripsWithNextArrival[index + 1];
    const prevTrip = index > 0 ? tripsWithNextArrival[index - 1] : null;

    // PrevKey: key of previous trip (undefined for first trip)
    const prevKey = prevTrip?.Key;

    // NextKey: key of next trip (undefined for last trip)
    const nextKey = nextTrip?.Key;

    // NextDepartingTime: scheduled departure time of next trip (undefined for last trip)
    const nextDepartingTime = nextTrip?.DepartingTime;

    // EstArriveCurr: EstArriveNext of previous trip, but only if it's <= DepartingTime
    let estArriveCurr = prevTrip?.EstArriveNext;
    if (estArriveCurr !== undefined && estArriveCurr > trip.DepartingTime) {
      estArriveCurr = undefined; // Validation violation - negative layover time
    }

    return {
      ...trip,
      PrevKey: prevKey,
      NextKey: nextKey,
      NextDepartingTime: nextDepartingTime,
      EstArriveCurr: estArriveCurr,
    };
  });
};

/**
 * Calculates estimated arrival time at the next terminal.
 *
 * Uses actual arrival time if available, otherwise estimates using historical
 * mean crossing time for the terminal pair.
 *
 * @param trip - Scheduled trip with departure and terminal information
 * @returns Estimated arrival time in milliseconds, or undefined if cannot be calculated
 */
const calculateEstArriveNext = (
  trip: ConvexScheduledTrip
): number | undefined => {
  // If actual arrival time exists, use it (no rounding needed for real data)
  if (trip.ArrivingTime !== undefined) {
    return trip.ArrivingTime;
  }

  // Otherwise, estimate using mean crossing time
  const terminalPair = formatTerminalPairKey(
    trip.DepartingTerminalAbbrev,
    trip.ArrivingTerminalAbbrev
  );

  const meanDurationMinutes = config.getMeanAtSeaDuration(terminalPair);

  // Skip calculation if terminal pair not found in config
  if (meanDurationMinutes === 0) {
    return undefined;
  }

  // Add mean duration to departure time and round up to next minute
  const estimatedArrivalMs =
    trip.DepartingTime + meanDurationMinutes * 60 * 1000;
  return roundUpToNextMinute(estimatedArrivalMs);
};
