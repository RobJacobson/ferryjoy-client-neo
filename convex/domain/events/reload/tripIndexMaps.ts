/**
 * Trip index maps for reload: segment key to TripKey and vessel to active trip.
 */

import type {
  ActiveTripForPhysicalActualReconcile,
  TripContextForActualRow,
  TripRowForActualContext,
} from "./types";

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
  trips: ActiveTripForPhysicalActualReconcile[]
): Map<string, ActiveTripForPhysicalActualReconcile & { TripKey: string }> => {
  const map = new Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >();

  for (const trip of trips) {
    if (trip.TripKey !== undefined) {
      map.set(trip.VesselAbbrev, { ...trip, TripKey: trip.TripKey });
    }
  }

  return map;
};

export { indexActiveTripsByVesselAbbrev, indexTripsBySegmentKey };
