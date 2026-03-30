/**
 * Direct-segment classification for schedule-derived trip rows.
 *
 * The raw WSF schedule can expose multiple logical trips for a single physical
 * departure. This module identifies the immediate next stop as the direct
 * segment and marks the remaining rows as indirect views of the same sailing.
 */

import {
  groupTripsByPhysicalDepartureGeneric,
  groupTripsByVesselGeneric,
} from "./grouping";

type DirectSegmentInput = {
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  Key: string;
};

type DirectSegmentResult<TTrip extends DirectSegmentInput> = TTrip & {
  TripType: "direct" | "indirect";
  DirectKey?: string;
};

/**
 * Classifies trip-like rows into direct and indirect physical segments using
 * only physical-departure grouping and next-terminal lookahead.
 */
export const classifyDirectSegments = <TTrip extends DirectSegmentInput>(
  trips: TTrip[]
): DirectSegmentResult<TTrip>[] => {
  const tripsByVessel = groupTripsByVesselGeneric(trips);

  return Object.values(tripsByVessel).flatMap((vesselTrips) => {
    const sortedTrips = [...vesselTrips].sort(
      (a, b) => a.DepartingTime - b.DepartingTime
    );
    const groups = groupTripsByPhysicalDepartureGeneric(sortedTrips);

    return groups.flatMap((group, index) => {
      const nextTerminal = groups[index + 1]?.departingTerminal;
      return classifyDepartureGroup(group.trips, nextTerminal);
    });
  });
};

/**
 * Classifies one physical-departure group using the next departure terminal as
 * the lookahead signal.
 *
 * @param trips - Rows that share a single physical departure
 * @param nextTerminal - Departing terminal of the vessel's next physical
 * departure, when known
 * @returns Group rows marked as direct or indirect
 */
const classifyDepartureGroup = <TTrip extends DirectSegmentInput>(
  trips: TTrip[],
  nextTerminal: string | undefined
): DirectSegmentResult<TTrip>[] => {
  if (!nextTerminal) {
    return trips.map((trip) => ({ ...trip, TripType: "direct" as const }));
  }

  const directMatch = trips.find(
    (trip) => trip.ArrivingTerminalAbbrev === nextTerminal
  );
  const directKey = directMatch?.Key;

  return trips.map((trip) => ({
    ...trip,
    TripType:
      !directMatch || trip.ArrivingTerminalAbbrev === nextTerminal
        ? ("direct" as const)
        : ("indirect" as const),
    DirectKey: directKey,
  }));
};
