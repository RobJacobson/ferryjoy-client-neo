/**
 * Scheduled trip chain + estimate calculation.
 *
 * Ported from `convex/functions/scheduledTrips/sync/businessLogic.ts`, but with
 * **official crossing times** (not ML means) and with arrival-time preference:
 * - Use `ArrivingTime` when present and sane
 * - Else fall back to official crossing times when configured
 */

import { getOfficialCrossingTimeMinutes } from "./officialCrossingTimes";
import type { ScheduledTripMs } from "./types";

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate PrevKey, NextKey, NextDepartingTime, EstArriveNext, and EstArriveCurr.
 * Must be called after direct/indirect classification.
 *
 * @param trips - Classified scheduled trips (ms timestamps)
 * @returns Enhanced trips
 */
export const calculateTripEstimates = (trips: ScheduledTripMs[]): ScheduledTripMs[] => {
  const tripsByVessel = groupTripsByVessel(trips);
  return Object.values(tripsByVessel).flatMap(calculateVesselTripEstimates);
};

// ============================================================================
// INTERNAL HELPERS (ported + adjusted)
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
 * Calculate estimates for a single vessel's chronologically sorted trips.
 *
 * @param vesselTrips - Trips for one vessel (unsorted OK)
 * @returns Enhanced trips for that vessel
 */
const calculateVesselTripEstimates = (
  vesselTrips: ScheduledTripMs[]
): ScheduledTripMs[] => {
  if (vesselTrips.length === 0) return [];

  vesselTrips.sort((a, b) => a.DepartingTime - b.DepartingTime);

  // First pass: compute EstArriveNext for all trips.
  const tripsWithNextArrival = vesselTrips.map((trip) => ({
    ...trip,
    EstArriveNext: calculateEstArriveNext(trip),
  }));

  // Second pass: set PrevKey/NextKey/NextDepartingTime and compute EstArriveCurr.
  //
  // NOTE: WSF can emit multiple schedule options that share the same departure
  // time + departing terminal (direct + indirect). We must not treat same-time
  // siblings as "previous" trips.
  const lastArriveByTerminal: Record<string, number | undefined> = {};
  const lastDirectKeyByArrivingTerminal: Record<string, string | undefined> = {};
  const enhancedTrips: ScheduledTripMs[] = [];

  for (let index = 0; index < tripsWithNextArrival.length; ) {
    const referenceTrip = tripsWithNextArrival[index];
    if (!referenceTrip) break;

    let groupEndExclusive = index + 1;
    while (groupEndExclusive < tripsWithNextArrival.length) {
      const candidate = tripsWithNextArrival[groupEndExclusive];
      if (!candidate) break;

      const isSameOverlapGroup =
        candidate.DepartingTime === referenceTrip.DepartingTime &&
        candidate.DepartingTerminalAbbrev === referenceTrip.DepartingTerminalAbbrev;

      if (!isSameOverlapGroup) break;
      groupEndExclusive += 1;
    }

    // Determine the next DIRECT trip after this overlap group.
    const nextDirectTrip = tripsWithNextArrival
      .slice(groupEndExclusive)
      .find((trip) => trip.TripType === "direct");

    const prevDirectKey =
      lastDirectKeyByArrivingTerminal[referenceTrip.DepartingTerminalAbbrev];
    const nextDirectKey = nextDirectTrip?.Key;
    const nextDirectDepartingTime = nextDirectTrip?.DepartingTime;

    // Apply patches for this overlap group using arrivals from *earlier* departures only.
    for (let i = index; i < groupEndExclusive; i += 1) {
      const trip = tripsWithNextArrival[i];
      if (!trip) continue;

      let estArriveCurr = lastArriveByTerminal[trip.DepartingTerminalAbbrev];
      if (estArriveCurr !== undefined && estArriveCurr > trip.DepartingTime) {
        estArriveCurr = undefined;
      }

      enhancedTrips.push({
        ...trip,
        PrevKey: prevDirectKey,
        NextKey: nextDirectKey,
        NextDepartingTime: nextDirectDepartingTime,
        EstArriveCurr: estArriveCurr,
      });
    }

    // Update arrival knowledge AFTER processing the whole overlap group so siblings
    // don't become each other's previous context.
    for (let i = index; i < groupEndExclusive; i += 1) {
      const trip = tripsWithNextArrival[i];
      if (!trip) continue;
      if (trip.TripType !== "direct") continue;
      if (trip.EstArriveNext === undefined) continue;

      lastArriveByTerminal[trip.ArrivingTerminalAbbrev] = trip.EstArriveNext;
      lastDirectKeyByArrivingTerminal[trip.ArrivingTerminalAbbrev] = trip.Key;
    }

    index = groupEndExclusive;
  }

  return enhancedTrips;
};

/**
 * Calculate estimated arrival time at the next terminal.
 *
 * @param trip - Scheduled trip (ms timestamps)
 * @returns Arrival time in epoch ms, or undefined if unknown
 */
const calculateEstArriveNext = (trip: ScheduledTripMs): number | undefined => {
  if (trip.ArrivingTime !== undefined && trip.ArrivingTime > trip.DepartingTime) {
    return roundUpToNextMinute(trip.ArrivingTime);
  }

  const minutes = getOfficialCrossingTimeMinutes({
    routeAbbrev: trip.RouteAbbrev,
    departingTerminalAbbrev: trip.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
  });

  if (minutes === undefined) return undefined;

  const estimatedArrivalMs = trip.DepartingTime + minutes * 60 * 1000;
  return roundUpToNextMinute(estimatedArrivalMs);
};

/**
 * Round a timestamp upward to the next minute boundary.
 *
 * @param timeMs - Epoch milliseconds
 * @returns Rounded epoch milliseconds
 */
const roundUpToNextMinute = (timeMs: number): number => {
  const date = new Date(timeMs);
  const seconds = date.getSeconds();
  const milliseconds = date.getMilliseconds();

  if (seconds > 0 || milliseconds > 0) {
    date.setMinutes(date.getMinutes() + 1);
    date.setSeconds(0);
    date.setMilliseconds(0);
  }

  return date.getTime();
};

