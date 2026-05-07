/**
 * Loads vessel-trip indexes used by actual dock-event reloads.
 *
 * Static actual reloads need to attach schedule-backed and physical-only
 * observations to the stable physical TripKey stored in vessel-trip tables.
 */

import type { MutationCtx } from "_generated/server";
import {
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
} from "domain/events/reload";

/**
 * Loads active and completed trips for one sailing day.
 *
 * @param ctx - Convex mutation context used for trip table reads
 * @param sailingDay - Target sailing day string
 * @returns Segment, active-trip, and physical-only indexes for actual reload
 */
const loadTripIndexesForSailingDay = async (
  ctx: MutationCtx,
  sailingDay: string
) => {
  const activeTrips = await ctx.db
    .query("activeVesselTrips")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", sailingDay))
    .collect();
  const completedTrips = await ctx.db
    .query("completedVesselTrips")
    .withIndex("by_sailing_day_and_departing_terminal", (q) =>
      q.eq("SailingDay", sailingDay)
    )
    .collect();

  return {
    tripBySegmentKey: indexTripsBySegmentKey([
      ...activeTrips,
      ...completedTrips,
    ]),
    activeTripsByVesselAbbrev: indexActiveTripsByVesselAbbrev(activeTrips),
    physicalOnlyTrips: [...activeTrips, ...completedTrips].filter(
      (trip) => trip.ScheduleKey === undefined
    ),
  };
};

export { loadTripIndexesForSailingDay };
