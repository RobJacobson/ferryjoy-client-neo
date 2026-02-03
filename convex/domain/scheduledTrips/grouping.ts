/**
 * Shared grouping utilities for scheduled trips.
 * Standardizes how we identify physical vessel movements.
 *
 * @module
 */

import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";

/**
 * Represents a physical vessel departure from a terminal.
 * A single physical departure can represent multiple logical trips (destinations).
 */
export type PhysicalDeparture = {
  departingTerminal: string;
  departingTime: number;
  vesselAbbrev: string;
  trips: ConvexScheduledTrip[];
};

/**
 * Groups trips by vessel abbreviation for chronological processing.
 *
 * @param trips - Array of scheduled trips
 * @returns Record mapping vessel abbreviations to their trips
 */
export const groupTripsByVessel = (
  trips: ConvexScheduledTrip[]
): Record<string, ConvexScheduledTrip[]> =>
  trips.reduce(
    (acc, trip) => {
      acc[trip.VesselAbbrev] ??= [];
      acc[trip.VesselAbbrev].push(trip);
      return acc;
    },
    {} as Record<string, ConvexScheduledTrip[]>
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
): PhysicalDeparture[] => {
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
  }, [] as PhysicalDeparture[]);
};
