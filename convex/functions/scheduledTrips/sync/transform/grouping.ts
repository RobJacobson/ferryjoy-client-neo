/**
 * Shared grouping utilities for schedule-derived segment sets.
 * Standardizes how we identify physical vessel movements.
 *
 * @module
 */

import type { ConvexScheduledTrip } from "../../schemas";

export type PhysicalDepartureInput = {
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  DepartingTime: number;
};

/**
 * Represents a physical vessel departure from a terminal.
 * A single physical departure can represent multiple logical trips (destinations).
 */
export type PhysicalDeparture<
  TTrip extends PhysicalDepartureInput = ConvexScheduledTrip,
> = {
  departingTerminal: string;
  departingTime: number;
  vesselAbbrev: string;
  trips: TTrip[];
};

/**
 * Groups trips by vessel abbreviation for chronological processing.
 *
 * @param trips - Array of scheduled trips
 * @returns Record mapping vessel abbreviations to their trips
 */
export const groupTripsByVessel = (
  trips: ConvexScheduledTrip[]
): Record<string, ConvexScheduledTrip[]> => groupTripsByVesselGeneric(trips);

/**
 * Groups any trip-like records by vessel abbreviation for chronological
 * domain processing.
 *
 * @param trips - Trip-like records that carry a `VesselAbbrev`
 * @returns Records grouped by vessel abbreviation
 */
export const groupTripsByVesselGeneric = <TTrip extends PhysicalDepartureInput>(
  trips: TTrip[]
): Record<string, TTrip[]> =>
  trips.reduce(
    (acc, trip) => {
      acc[trip.VesselAbbrev] ??= [];
      acc[trip.VesselAbbrev].push(trip);
      return acc;
    },
    {} as Record<string, TTrip[]>
  );

/**
 * Groups a vessel's trips by their physical departure (terminal and time).
 * Assumes trips are already sorted chronologically.
 *
 * @param vesselTrips - Chronologically sorted trips for a single vessel
 * @returns Array of PhysicalDeparture groups
 */
export const groupTripsByPhysicalDeparture = (
  vesselTrips: ConvexScheduledTrip[]
): PhysicalDeparture[] => groupTripsByPhysicalDepartureGeneric(vesselTrips);

/**
 * Groups chronologically sorted trip-like records by physical departure.
 *
 * Records remain grouped only when vessel, departure terminal, and departure
 * time all describe the same physical sailing.
 *
 * @param vesselTrips - Chronologically sorted trips for a single vessel
 * @returns Physical-departure groups preserving input order
 */
export const groupTripsByPhysicalDepartureGeneric = <
  TTrip extends PhysicalDepartureInput,
>(
  vesselTrips: TTrip[]
): PhysicalDeparture<TTrip>[] => {
  if (vesselTrips.length === 0) return [];

  return vesselTrips.reduce((groups, trip) => {
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
        vesselAbbrev: trip.VesselAbbrev,
        trips: [trip],
      });
    }
    return groups;
  }, [] as PhysicalDeparture<TTrip>[]);
};
