/**
 * Logic for calculating arrival estimates and linking physical vessel segments.
 *
 * @module
 */

import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import { roundUpToNextMinute } from "../../../shared/durationUtils";
import { config, formatTerminalPairKey } from "../../ml/shared/config";
import {
  groupTripsByPhysicalDeparture,
  groupTripsByVessel,
  type PhysicalDeparture,
} from "../grouping";
import { getOfficialCrossingTimeMinutes } from "./officialCrossingTimes";

/**
 * State for tracking vessel movements across a single pass.
 */
type VesselState = {
  lastArriveByTerminal: Record<string, number>;
  lastSchedArriveByTerminal: Record<string, number>;
  lastDirectKeyByTerminal: Record<string, string>;
};

/**
 * Calculates arrival estimates and links segments (PrevKey, NextKey) in a single pass.
 *
 * @param trips - Classified trips (with TripType set)
 * @returns Trips with all estimate and connection fields populated
 */
export const calculateTripEstimates = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  const tripsByVessel = groupTripsByVessel(trips);

  return Object.values(tripsByVessel).flatMap((vesselTrips) => {
    const sortedTrips = [...vesselTrips].sort(
      (a, b) => a.DepartingTime - b.DepartingTime
    );
    const groups = groupTripsByPhysicalDeparture(sortedTrips);

    // Initial pass: Calculate arrival times for all trips
    // Direct trips use durations; Indirect trips will be backfilled later
    const tripsWithArrivals = sortedTrips.map((trip) => ({
      ...trip,
      SchedArriveNext:
        trip.TripType === "direct" ? calculateSchedArrive(trip) : undefined,
      EstArriveNext:
        trip.TripType === "direct" ? calculateEstArrive(trip) : undefined,
    }));

    // Backfill indirect arrivals by looking ahead in the vessel's day
    const backfilledTrips = tripsWithArrivals.map((trip) => {
      if (trip.TripType === "direct") return trip;
      const completion = findCompletionArrival(trip, tripsWithArrivals);
      return {
        ...trip,
        SchedArriveNext: completion?.sched,
        EstArriveNext: completion?.est,
      };
    });

    // Final pass: Link keys and set arrival-at-current-terminal times
    return linkVesselSegments(backfilledTrips, groups);
  });
};

/**
 * Links segments and sets EstArriveCurr/SchedArriveCurr using a stateful scan.
 */
const linkVesselSegments = (
  trips: ConvexScheduledTrip[],
  groups: PhysicalDeparture[]
): ConvexScheduledTrip[] => {
  const state: VesselState = {
    lastArriveByTerminal: {},
    lastSchedArriveByTerminal: {},
    lastDirectKeyByTerminal: {},
  };

  return groups.flatMap((group, index) => {
    const nextDirect = groups
      .slice(index + 1)
      .flatMap((g) => g.trips)
      .find((t) => t.TripType === "direct");

    const prevDirectKey =
      state.lastDirectKeyByTerminal[group.departingTerminal];

    const updatedTrips = group.trips.map((trip) => {
      const tripWithConnections = {
        ...trip,
        // Connections
        PrevKey: prevDirectKey,
        NextKey: nextDirect?.Key,
        NextDepartingTime: nextDirect?.DepartingTime,
        // Arrivals at current terminal (if valid)
        EstArriveCurr: validateArrivalTime(
          state.lastArriveByTerminal[group.departingTerminal],
          group.departingTime
        ),
        SchedArriveCurr: validateArrivalTime(
          state.lastSchedArriveByTerminal[group.departingTerminal],
          group.departingTime
        ),
      };

      // Find the specific trip in the backfilled array to get its calculated arrivals
      const backfilled = trips.find((t) => t.Key === trip.Key);
      if (!backfilled) {
        throw new Error(`[ESTIMATES] Trip ${trip.Key} not found in backfilled array`);
      }
      return {
        ...tripWithConnections,
        SchedArriveNext: backfilled.SchedArriveNext,
        EstArriveNext: backfilled.EstArriveNext,
      };
    });

    // Update state for next groups based on DIRECT trips in this group
    for (const trip of updatedTrips) {
      if (trip.TripType !== "direct") continue;
      const dest = trip.ArrivingTerminalAbbrev;
      if (trip.EstArriveNext)
        state.lastArriveByTerminal[dest] = trip.EstArriveNext;
      if (trip.SchedArriveNext)
        state.lastSchedArriveByTerminal[dest] = trip.SchedArriveNext;
      state.lastDirectKeyByTerminal[dest] = trip.Key;
    }

    return updatedTrips;
  });
};

/**
 * Validates that an arrival time happened before the departure.
 */
const validateArrivalTime = (arrival: number | undefined, departure: number) =>
  arrival !== undefined && arrival <= departure ? arrival : undefined;

/**
 * Calculates estimated arrival using historical mean durations.
 */
const calculateEstArrive = (trip: ConvexScheduledTrip): number | undefined => {
  const pair = formatTerminalPairKey(
    trip.DepartingTerminalAbbrev,
    trip.ArrivingTerminalAbbrev
  );
  const duration = config.getMeanAtSeaDuration(pair);
  return duration > 0
    ? roundUpToNextMinute(trip.DepartingTime + duration * 60 * 1000)
    : undefined;
};

/**
 * Calculates scheduled arrival using official crossing times.
 */
const calculateSchedArrive = (
  trip: ConvexScheduledTrip
): number | undefined => {
  // Route 9 (San Juans) often has ArrivingTime in raw data
  if (trip.RouteID === 9 && trip.ArrivingTime) return trip.ArrivingTime;

  const duration = getOfficialCrossingTimeMinutes({
    routeAbbrev: trip.RouteAbbrev,
    departingTerminalAbbrev: trip.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
  });

  return duration !== undefined
    ? roundUpToNextMinute(trip.DepartingTime + duration * 60 * 1000)
    : undefined;
};

/**
 * Finds the completion arrival for an indirect trip by looking ahead.
 */
const findCompletionArrival = (
  indirect: ConvexScheduledTrip,
  allTrips: ConvexScheduledTrip[]
) => {
  const completion = allTrips.find(
    (t) =>
      t.TripType === "direct" &&
      t.ArrivingTerminalAbbrev === indirect.ArrivingTerminalAbbrev &&
      t.DepartingTime > indirect.DepartingTime
  );

  return completion
    ? { est: completion.EstArriveNext, sched: completion.SchedArriveNext }
    : null;
};
