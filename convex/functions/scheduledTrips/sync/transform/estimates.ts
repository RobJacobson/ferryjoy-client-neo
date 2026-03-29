/**
 * Logic for calculating arrival estimates and linking physical vessel segments.
 *
 * @module
 */

import type { ConvexScheduledTrip } from "../../schemas";
import { roundUpToNextMinute } from "../../../../shared/durationUtils";
import { config, formatTerminalPairKey } from "../../../../domain/ml/shared/config";
import {
  groupTripsByPhysicalDeparture,
  groupTripsByVessel,
  type PhysicalDeparture,
} from "./grouping";
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

    const tripsWithArrivals = sortedTrips.map((trip) => ({
      ...trip,
      SchedArriveNext:
        trip.TripType === "direct" ? calculateSchedArrive(trip) : undefined,
      EstArriveNext:
        trip.TripType === "direct" ? calculateEstArrive(trip) : undefined,
    }));

    const backfilledTrips = tripsWithArrivals.map((trip) => {
      if (trip.TripType === "direct") return trip;
      const completion = findCompletionArrival(trip, tripsWithArrivals);
      return {
        ...trip,
        SchedArriveNext: completion?.sched,
        EstArriveNext: completion?.est,
      };
    });

    return linkVesselSegments(backfilledTrips, groups);
  });
};

/**
 * Links segments and sets EstArriveCurr/SchedArriveCurr using a stateful scan.
 *
 * @param trips - Trip rows that already carry their arrival-at-next estimates
 * @param groups - Physical-departure groups for the same vessel/day slice
 * @returns Trips with current-terminal arrivals plus Prev/Next links populated
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
        PrevKey: prevDirectKey,
        NextKey: nextDirect?.Key,
        NextDepartingTime: nextDirect?.DepartingTime,
        EstArriveCurr: validateArrivalTime(
          state.lastArriveByTerminal[group.departingTerminal],
          group.departingTime
        ),
        SchedArriveCurr: validateArrivalTime(
          state.lastSchedArriveByTerminal[group.departingTerminal],
          group.departingTime
        ),
      };

      const backfilled = trips.find((t) => t.Key === trip.Key);
      if (!backfilled) {
        throw new Error(
          `[ESTIMATES] Trip ${trip.Key} not found in backfilled array`
        );
      }
      return {
        ...tripWithConnections,
        SchedArriveNext: backfilled.SchedArriveNext,
        EstArriveNext: backfilled.EstArriveNext,
      };
    });

    for (const trip of updatedTrips) {
      if (trip.TripType !== "direct") continue;
      const dest = trip.ArrivingTerminalAbbrev;
      if (trip.EstArriveNext) {
        state.lastArriveByTerminal[dest] = trip.EstArriveNext;
      }
      if (trip.SchedArriveNext) {
        state.lastSchedArriveByTerminal[dest] = trip.SchedArriveNext;
      }
      state.lastDirectKeyByTerminal[dest] = trip.Key;
    }

    return updatedTrips;
  });
};

/**
 * Validates that an arrival timestamp is plausible for the current departure.
 *
 * @param arrival - Candidate arrival timestamp in epoch milliseconds
 * @param departure - Departure timestamp that the arrival must not exceed
 * @returns The arrival when it is valid, otherwise `undefined`
 */
const validateArrivalTime = (arrival: number | undefined, departure: number) =>
  arrival !== undefined && arrival <= departure ? arrival : undefined;

/**
 * Calculates estimated arrival using route-level historical mean at-sea
 * duration.
 *
 * @param trip - Direct trip row to estimate
 * @returns Rounded estimated arrival time, or `undefined` when no prior exists
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
 * Calculates scheduled arrival using the current domain policy.
 *
 * Route 9 trusts the raw WSF `ArrivingTime` when present. Other routes fall
 * back to curated official crossing times so schedule-derived rows stay
 * consistent with the physical-departure model.
 *
 * @param trip - Direct trip row to derive a scheduled arrival for
 * @returns Scheduled arrival time, or `undefined` when no source is available
 */
const calculateSchedArrive = (
  trip: ConvexScheduledTrip
): number | undefined => {
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
 * Finds the later direct segment that completes an indirect trip's journey.
 *
 * @param indirect - Indirect trip row that needs backfilled arrivals
 * @param allTrips - Same-vessel trip rows with direct arrivals already derived
 * @returns Backfilled estimated and scheduled arrivals, or `null`
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
