/**
 * Trip index maps for reload: segment key to TripKey and vessel to active trip.
 */

import type {
  ReloadTripForActuals,
  TripContextForActualRow,
  TripRowForActualContext,
} from "../types";

type ReloadTripIndexes = {
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ReloadTripForActuals & { TripKey: string }
  >;
  physicalOnlyTrips: ReloadTripForActuals[];
};

/**
 * Indexes physical TripKey by schedule-backed or physical segment key.
 *
 * @param trips - Active and completed trip rows for the reload sailing day
 * @returns Map from segment key to physical trip context
 */
const indexTripsBySegmentKey = (
  trips: TripRowForActualContext[]
): Map<string, TripContextForActualRow> => {
  const map = new Map<string, TripContextForActualRow>();

  for (const trip of trips) {
    if (!trip.TripKey) {
      continue;
    }

    map.set(trip.ScheduleKey ?? trip.TripKey, { TripKey: trip.TripKey });
  }

  return map;
};

/**
 * Indexes active trips by vessel abbreviation for live physical patches.
 *
 * @param trips - Active trips in the reload scope
 * @returns Map from vessel abbreviation to the trip carrying TripKey
 */
const indexActiveTripsByVesselAbbrev = (
  trips: ReloadTripForActuals[]
): Map<string, ReloadTripForActuals & { TripKey: string }> => {
  const map = new Map<string, ReloadTripForActuals & { TripKey: string }>();

  for (const trip of trips) {
    if (trip.TripKey !== undefined) {
      map.set(trip.VesselAbbrev, { ...trip, TripKey: trip.TripKey });
    }
  }

  return map;
};

/**
 * Builds the trip indexes the reload pipeline reads while assembling rows.
 *
 * The reload computation needs three projections of the same trip set: a
 * segment-to-trip lookup for stamping TripKeys on actual rows, an active-trip
 * lookup by vessel for the live-location fallback, and a list of
 * physical-only trips that bypass scheduled boundaries entirely. Computing
 * all three together avoids walking the trip arrays multiple times in the
 * hot path.
 *
 * @param args.activeTrips - Active vessel trips for the reload sailing day
 * @param args.completedTrips - Completed vessel trips for the reload sailing day
 * @returns Segment, vessel, and physical-only trip indexes for one reload
 */
const indexTripsForReload = ({
  activeTrips,
  completedTrips,
}: {
  activeTrips: ReloadTripForActuals[];
  completedTrips: ReloadTripForActuals[];
}): ReloadTripIndexes => {
  const allTrips = [...activeTrips, ...completedTrips];

  return {
    tripBySegmentKey: indexTripsBySegmentKey(allTrips),
    activeTripsByVesselAbbrev: indexActiveTripsByVesselAbbrev(activeTrips),
    physicalOnlyTrips: allTrips.filter(
      (trip) => trip.ScheduleKey === undefined
    ),
  };
};

export type { ReloadTripIndexes };
export { indexTripsForReload };
