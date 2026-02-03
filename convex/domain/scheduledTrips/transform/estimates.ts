import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import { roundUpToNextMinute } from "../../../shared/durationUtils";
import { config, formatTerminalPairKey } from "../../ml/shared/config";
import { groupTripsByPhysicalDeparture, groupTripsByVessel } from "../grouping";
import { getOfficialCrossingTimeMinutes } from "./officialCrossingTimes";

/**
 * Calculates PrevKey, NextKey, NextDepartingTime, EstArriveNext, and EstArriveCurr
 * for all trips.
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
 */
const calculateDirectTripArrivals = (
  vesselTrips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  return vesselTrips.map((trip) => {
    const schedArriveNext =
      trip.RouteID === 9 && trip.ArrivingTime
        ? trip.ArrivingTime
        : calculateSchedArriveNext(trip);

    return {
      ...trip,
      EstArriveNext:
        trip.TripType === "direct" ? calculateEstArriveNext(trip) : undefined,
      SchedArriveNext: trip.TripType === "direct" ? schedArriveNext : undefined,
    };
  });
};

/**
 * Matches indirect trips to their completion direct trips to get correct arrival times.
 */
const calculateIndirectTripArrivals = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  const directArrivalLookup = buildDirectArrivalLookup(trips);

  return trips.map((trip) => {
    if (trip.TripType === "direct") return trip;

    const completionArrivals = findCompletionArrivals(
      trip,
      directArrivalLookup
    );

    return {
      ...trip,
      EstArriveNext: completionArrivals.estArriveNext,
      SchedArriveNext: completionArrivals.schedArriveNext,
    };
  });
};

/**
 * Calculates PrevKey, NextKey, NextDepartingTime, and EstArriveCurr for all trips.
 */
const calculateTripConnections = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  const lastArriveByTerminal: Record<string, number | undefined> = {};
  const lastSchedArriveByTerminal: Record<string, number | undefined> = {};
  const lastDirectKeyByArrivingTerminal: Record<string, string | undefined> =
    {};
  const enhancedTrips: ConvexScheduledTrip[] = [];

  // Sort chronologically
  trips.sort((a, b) => a.DepartingTime - b.DepartingTime);

  const groups = groupTripsByPhysicalDeparture(trips);

  for (let index = 0; index < groups.length; index++) {
    const { trips: group, departingTerminal, departingTime } = groups[index];
    const nextDirectTrip = groups
      .slice(index + 1)
      .flatMap((g: any) => g.trips)
      .find((t: any) => t.TripType === "direct");

    const prevDirectKey = lastDirectKeyByArrivingTerminal[departingTerminal];
    const nextDirectKey = nextDirectTrip?.Key;
    const nextDirectDepartingTime = nextDirectTrip?.DepartingTime;

    for (const trip of group) {
      let estArriveCurr = lastArriveByTerminal[departingTerminal];
      if (estArriveCurr !== undefined && estArriveCurr > departingTime) {
        estArriveCurr = undefined;
      }

      let schedArriveCurr = lastSchedArriveByTerminal[departingTerminal];
      if (schedArriveCurr !== undefined && schedArriveCurr > departingTime) {
        schedArriveCurr = undefined;
      }

      enhancedTrips.push({
        ...trip,
        PrevKey: prevDirectKey,
        NextKey: nextDirectKey,
        NextDepartingTime: nextDirectDepartingTime,
        EstArriveCurr: estArriveCurr,
        SchedArriveCurr: schedArriveCurr,
      });
    }

    // Update arrival knowledge for next groups
    for (const trip of group) {
      if (trip.TripType !== "direct") continue;
      if (trip.EstArriveNext !== undefined) {
        lastArriveByTerminal[trip.ArrivingTerminalAbbrev] = trip.EstArriveNext;
      }
      if (trip.SchedArriveNext !== undefined) {
        lastSchedArriveByTerminal[trip.ArrivingTerminalAbbrev] =
          trip.SchedArriveNext;
      }
      lastDirectKeyByArrivingTerminal[trip.ArrivingTerminalAbbrev] = trip.Key;
    }
  }

  return enhancedTrips;
};

const calculateEstArriveNext = (
  trip: ConvexScheduledTrip
): number | undefined => {
  const terminalPair = formatTerminalPairKey(
    trip.DepartingTerminalAbbrev,
    trip.ArrivingTerminalAbbrev
  );
  const meanDurationMinutes = config.getMeanAtSeaDuration(terminalPair);
  if (meanDurationMinutes === 0) return undefined;

  const estimatedArrivalMs =
    trip.DepartingTime + meanDurationMinutes * 60 * 1000;
  return roundUpToNextMinute(estimatedArrivalMs);
};

const calculateSchedArriveNext = (
  trip: ConvexScheduledTrip
): number | undefined => {
  const officialDurationMinutes = getOfficialCrossingTimeMinutes({
    routeAbbrev: trip.RouteAbbrev,
    departingTerminalAbbrev: trip.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
  });

  if (officialDurationMinutes === undefined) return undefined;

  const officialArrivalMs =
    trip.DepartingTime + officialDurationMinutes * 60 * 1000;
  return roundUpToNextMinute(officialArrivalMs);
};

const buildDirectArrivalLookup = (trips: ConvexScheduledTrip[]) => {
  const lookup = new Map<string, any[]>();
  for (const trip of trips) {
    if (trip.TripType !== "direct") continue;
    if (trip.EstArriveNext === undefined && trip.SchedArriveNext === undefined)
      continue;

    const key = `${trip.VesselAbbrev}->${trip.ArrivingTerminalAbbrev}`;
    if (!lookup.has(key)) lookup.set(key, []);
    lookup.get(key)?.push({
      departureTime: trip.DepartingTime,
      estArrivalTime: trip.EstArriveNext,
      schedArrivalTime: trip.SchedArriveNext,
    });
  }
  for (const arr of lookup.values()) {
    arr.sort((a, b) => a.departureTime - b.departureTime);
  }
  return lookup;
};

const findCompletionArrivals = (
  indirectTrip: ConvexScheduledTrip,
  directArrivalLookup: Map<string, any[]>
) => {
  const key = `${indirectTrip.VesselAbbrev}->${indirectTrip.ArrivingTerminalAbbrev}`;
  const arrivals = directArrivalLookup.get(key);
  if (!arrivals)
    return { estArriveNext: undefined, schedArriveNext: undefined };

  const completionTrip = arrivals.find(
    (arrival) => arrival.departureTime > indirectTrip.DepartingTime
  );
  if (!completionTrip)
    return { estArriveNext: undefined, schedArriveNext: undefined };

  return {
    estArriveNext: completionTrip.estArrivalTime,
    schedArriveNext: completionTrip.schedArrivalTime,
  };
};
