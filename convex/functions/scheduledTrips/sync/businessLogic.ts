import {
  config,
  formatTerminalPairKey,
} from "../../../domain/ml/shared/config";
import { roundUpToNextMinute } from "../../../shared/durationUtils";
import type { ConvexScheduledTrip } from "../schemas";

/**
 * Classifies trips as direct or indirect using a two-pointer chronological scan.
 * For multi-stage vessel trips, WSF API reports multiple destination options from the same
 * departure point. This function scans chronologically and uses lookahead to identify
 * which destination matches the vessel's actual next departure terminal.
 *
 * Algorithm:
 * 1. Group trips by vessel and sailing day, sort chronologically
 * 2. Scan through trips with two pointers (current + lookahead)
 * 3. When overlapping departures found, check next trip's departure terminal
 * 4. Mark trips where arrival terminal matches next departure terminal as "direct"
 * 5. Mark other overlapping trips as "indirect"
 *
 * @param trips - Array of scheduled trip records to classify
 * @returns Array of all trips with TripType field set to "direct" or "indirect"
 */
export const classifyTripsByType = (
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
 * Processes a single vessel's trips chronologically, classifying them as direct or indirect.
 *
 * @param vesselTrips - Array of trips for a single vessel
 * @returns Array of all trips with TripType field set to "direct" or "indirect"
 */
export const processVesselTrips = (
  vesselTrips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  if (vesselTrips.length === 0) return [];

  // Sort chronologically by departure time
  vesselTrips.sort((a, b) => a.DepartingTime - b.DepartingTime);

  const classifiedTrips: ConvexScheduledTrip[] = [];
  let i = 0;

  while (i < vesselTrips.length) {
    const overlappingTrips = findOverlappingGroup(vesselTrips, i);

    if (overlappingTrips.length === 1) {
      // Single trip - mark as direct
      classifiedTrips.push({
        ...overlappingTrips[0],
        TripType: "direct",
      });
      i += 1;
    } else {
      // Multiple overlapping trips - classify using lookahead
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
      classifiedTrips.push(...resolvedTrips);
      i += overlappingTrips.length;
    }
  }

  return classifiedTrips;
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
 * Resolves overlapping trips by classifying which one leads to the expected next terminal.
 * Marks the trip matching the next terminal as "direct" and others as "indirect".
 * If no trip matches the expected terminal, marks all as "direct" (fallback).
 *
 * @param overlappingTrips - Array of trips that depart at the same time
 * @param nextTerminal - Expected next departure terminal
 * @param vesselAbbrev - Vessel abbreviation for logging
 * @param departureTime - Departure time for logging
 * @returns Array of all trips with TripType field set to "direct" or "indirect"
 */
export const resolveOverlappingGroup = (
  overlappingTrips: ConvexScheduledTrip[],
  nextTerminal: string | undefined,
  vesselAbbrev: string,
  departureTime: number
): ConvexScheduledTrip[] => {
  if (!nextTerminal) {
    // No next departure found (end of vessel's schedule) - mark all as direct
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
    // Mark the correct trip as direct, others as indirect
    return overlappingTrips.map((trip) => ({
      ...trip,
      TripType:
        trip.ArrivingTerminalAbbrev === nextTerminal
          ? ("direct" as const)
          : ("indirect" as const),
    }));
  } else {
    // Fallback: no trip matches expected next terminal
    // This can happen with irregular schedules - mark all as direct
    console.warn(
      `No overlapping trip goes to expected next terminal ${nextTerminal} ` +
        `for vessel ${vesselAbbrev} departing at ${new Date(departureTime).toISOString()}`
    );
    return overlappingTrips.map((trip) => ({
      ...trip,
      TripType: "direct" as const,
    }));
  }
};

/**
 * Calculates PrevKey, NextKey, NextDepartingTime, EstArriveNext, and EstArriveCurr
 * for all trips.
 * Must be called after vessel-level filtering to ensure correct chronological order.
 *
 * Algorithm for indirect trips:
 * 1. Calculate arrival times for direct trips using historical mean at-sea durations
 * 2. Build a lookup map of direct trip arrivals organized by vessel and terminal
 * 3. Match indirect trips to the direct trip that completes their journey
 * 4. Use the direct trip's arrival time as the indirect trip's arrival time
 *
 * This ensures indirect trips account for docking time at intermediate terminals.
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
 * Algorithm:
 * 1. Calculate EstArriveNext for DIRECT trips only using historical mean at-sea durations
 * 2. Match indirect trips to their completion direct trips to get correct arrival times
 * 3. Set PrevKey/NextKey/NextDepartingTime/EstArriveCurr for all trips
 *
 * @param vesselTrips - Array of chronologically sorted trips for a single vessel
 * @returns Array of trips with calculated estimates (PrevKey, NextKey, etc.)
 */
const calculateVesselTripEstimates = (
  vesselTrips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  if (vesselTrips.length === 0) return [];

  // Pass 1: Calculate arrival times for direct trips
  const tripsWithDirectArrivals = calculateDirectTripArrivals(vesselTrips);

  // Pass 2: Match indirect trips to their completion direct trips
  const tripsWithAllArrivals = calculateIndirectTripArrivals(
    tripsWithDirectArrivals
  );

  // Pass 3: Set PrevKey/NextKey/NextDepartingTime/EstArriveCurr
  return calculateTripConnections(tripsWithAllArrivals);
};

/**
 * Calculates estimated arrival times for direct trips using historical mean at-sea durations.
 *
 * @param vesselTrips - Array of chronologically sorted trips for a single vessel
 * @returns Array of trips with EstArriveNext populated for direct trips only
 */
const calculateDirectTripArrivals = (
  vesselTrips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  return vesselTrips.map((trip) => ({
    ...trip,
    EstArriveNext:
      trip.TripType === "direct" ? calculateEstArriveNext(trip) : undefined,
  }));
};

/**
 * Matches indirect trips to their completion direct trips to get correct arrival times.
 *
 * @param trips - Array of trips with direct trip arrivals already calculated
 * @returns Array of trips with EstArriveNext populated for both direct and indirect trips
 */
const calculateIndirectTripArrivals = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  const directArrivalLookup = buildDirectArrivalLookup(trips);

  return trips.map((trip) => {
    if (trip.TripType === "direct") {
      // Direct trips already have their arrival time
      return trip;
    }

    // Indirect trip: find the completion direct trip
    const completionArrival = findCompletionArrival(trip, directArrivalLookup);

    return {
      ...trip,
      EstArriveNext: completionArrival,
    };
  });
};

/**
 * Calculates PrevKey, NextKey, NextDepartingTime, and EstArriveCurr for all trips.
 *
 * NOTE: WSF can emit multiple schedule options that share the same departure
 * time + departing terminal (direct + indirect). We must not treat same-time
 * siblings as "previous" trips, otherwise EstArriveCurr can be incorrectly
 * cleared by the negative-layover guard.
 *
 * @param trips - Array of trips with EstArriveNext populated
 * @returns Array of trips with all estimate fields populated
 */
const calculateTripConnections = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  const lastArriveByTerminal: Record<string, number | undefined> = {};
  const lastDirectKeyByArrivingTerminal: Record<string, string | undefined> =
    {};
  const enhancedTrips: ConvexScheduledTrip[] = [];

  for (let index = 0; index < trips.length; ) {
    const referenceTrip = trips[index];
    if (!referenceTrip) break;

    let groupEndExclusive = index + 1;
    while (groupEndExclusive < trips.length) {
      const candidate = trips[groupEndExclusive];
      if (!candidate) break;

      const isSameOverlapGroup =
        candidate.DepartingTime === referenceTrip.DepartingTime &&
        candidate.DepartingTerminalAbbrev ===
          referenceTrip.DepartingTerminalAbbrev;

      if (!isSameOverlapGroup) break;

      groupEndExclusive += 1;
    }

    // Determine the next DIRECT trip after this overlap group (skip indirects and
    // skip same-departure siblings entirely).
    const nextDirectTrip = trips
      .slice(groupEndExclusive)
      .find((trip) => trip.TripType === "direct");

    const prevDirectKey =
      lastDirectKeyByArrivingTerminal[referenceTrip.DepartingTerminalAbbrev];
    const nextDirectKey = nextDirectTrip?.Key;
    const nextDirectDepartingTime = nextDirectTrip?.DepartingTime;

    // Compute patches for this overlap group using arrivals from *earlier*
    // departures only (i.e., map state as of group start).
    for (let i = index; i < groupEndExclusive; i += 1) {
      const trip = trips[i];
      if (!trip) continue;

      // EstArriveCurr: last known DIRECT arrival into the current departing terminal,
      // but only if it's <= DepartingTime (avoid negative layover time).
      let estArriveCurr = lastArriveByTerminal[trip.DepartingTerminalAbbrev];
      if (estArriveCurr !== undefined && estArriveCurr > trip.DepartingTime) {
        estArriveCurr = undefined;
      }

      enhancedTrips.push({
        ...trip,
        // Prev/Next are keyed to the vessel's DIRECT trip chain, not indirect options.
        PrevKey: prevDirectKey,
        NextKey: nextDirectKey,
        NextDepartingTime: nextDirectDepartingTime,
        EstArriveCurr: estArriveCurr,
      });
    }

    // Update arrival knowledge AFTER processing the whole overlap group so
    // siblings don't become each other's "previous" context.
    for (let i = index; i < groupEndExclusive; i += 1) {
      const trip = trips[i];
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
  // Estimate using historical mean at-sea duration for the terminal pair.
  // We intentionally ignore any WSF-provided arrival time because it can be
  // imprecise or degenerate (e.g., arrival == departure).
  const terminalPair = formatTerminalPairKey(
    trip.DepartingTerminalAbbrev,
    trip.ArrivingTerminalAbbrev
  );

  const meanDurationMinutes = config.getMeanAtSeaDuration(terminalPair);

  // Skip calculation if terminal pair not found in config
  if (meanDurationMinutes === 0) {
    return undefined;
  }

  // Add duration to departure time and round up to next minute
  const estimatedArrivalMs =
    trip.DepartingTime + meanDurationMinutes * 60 * 1000;
  return roundUpToNextMinute(estimatedArrivalMs);
};

/**
 * Builds a lookup structure for matching indirect trips to their completion
 * direct trips. Organizes direct trips by vessel and arrival terminal for
 * efficient searching.
 *
 * @param trips - Array of trips including both direct and indirect
 * @returns Map keyed by "vessel->arrivalTerminal" with sorted arrival times
 */
const buildDirectArrivalLookup = (
  trips: ConvexScheduledTrip[]
): Map<string, Array<{ departureTime: number; arrivalTime: number }>> => {
  const lookup = new Map<
    string,
    Array<{ departureTime: number; arrivalTime: number }>
  >();

  for (const trip of trips) {
    if (trip.TripType !== "direct") continue;
    if (trip.EstArriveNext === undefined) continue;

    const key = `${trip.VesselAbbrev}->${trip.ArrivingTerminalAbbrev}`;

    if (!lookup.has(key)) {
      lookup.set(key, []);
    }

    lookup.get(key)?.push({
      departureTime: trip.DepartingTime,
      arrivalTime: trip.EstArriveNext,
    });
  }

  // Sort each array by departure time for efficient searching
  for (const arr of lookup.values()) {
    arr.sort((a, b) => a.departureTime - b.departureTime);
  }

  return lookup;
};

/**
 * Finds the estimated arrival time for an indirect trip by matching it to
 * the direct trip that completes the vessel's journey.
 *
 * Algorithm:
 * 1. Look up direct trips for the same vessel arriving at the indirect trip's
 *    arrival terminal
 * 2. Find the first direct trip that departs AFTER the indirect trip's departure
 * 3. Return that direct trip's arrival time
 *
 * This works because:
 * - Indirect trips represent the vessel's complete journey from departure to arrival
 * - The vessel will physically make the same stops and end at the same terminal
 * - The direct trip that departs from that arrival terminal completes the journey
 *
 * @param indirectTrip - The indirect trip to find completion arrival for
 * @param directArrivalLookup - Lookup map of direct trip arrivals
 * @returns Estimated arrival time, or undefined if not found
 */
const findCompletionArrival = (
  indirectTrip: ConvexScheduledTrip,
  directArrivalLookup: Map<
    string,
    Array<{ departureTime: number; arrivalTime: number }>
  >
): number | undefined => {
  const key = `${indirectTrip.VesselAbbrev}->${indirectTrip.ArrivingTerminalAbbrev}`;
  const arrivals = directArrivalLookup.get(key);

  if (!arrivals || arrivals.length === 0) {
    console.warn(
      `No direct trips found matching ${indirectTrip.VesselAbbrev}->` +
        `${indirectTrip.ArrivingTerminalAbbrev} for indirect trip ${indirectTrip.Key}`
    );
    return undefined;
  }

  // Find the first direct trip that departs AFTER the indirect trip's departure
  // Use binary search or simple iteration (sorted by departure time)
  const completionTrip = arrivals.find(
    (arrival) => arrival.departureTime > indirectTrip.DepartingTime
  );

  if (!completionTrip) {
    console.warn(
      `No direct trip departing after ${new Date(indirectTrip.DepartingTime).toISOString()} ` +
        `found for ${indirectTrip.VesselAbbrev}->${indirectTrip.ArrivingTerminalAbbrev}`
    );
    return undefined;
  }

  return completionTrip.arrivalTime;
};
