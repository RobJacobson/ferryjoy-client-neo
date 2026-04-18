/**
 * Loads vessel trip rows for a sailing day and builds indexes used during
 * timeline reseed.
 */

import type { MutationCtx } from "_generated/server";
import {
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
} from "domain/timelineRows";

/**
 * Loads active and completed trips for a sailing day and indexes them by
 * segment key for `TripKey` resolution. Uses `by_sailing_day` on
 * `activeVesselTrips` and `by_sailing_day_and_departing_terminal` on
 * `completedVesselTrips` (lookup by `SailingDay` only) to avoid full scans.
 *
 * @param ctx - Mutation context
 * @param sailingDay - Target sailing day
 * @returns Trip maps and physical-only trips for reseed reconciliation
 */
export const loadTripIndexesForSailingDay = async (
  ctx: MutationCtx,
  sailingDay: string
) => {
  // Load the active trips
  const activeTrips = await ctx.db
    .query("activeVesselTrips")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", sailingDay))
    .collect();

  // Load the completed trips
  const completedTrips = await ctx.db
    .query("completedVesselTrips")
    .withIndex("by_sailing_day_and_departing_terminal", (q) =>
      q.eq("SailingDay", sailingDay)
    )
    .collect();

  // Return the trips by segment key
  return {
    tripBySegmentKey: indexTripsBySegmentKey([
      ...activeTrips,
      ...completedTrips,
    ]),
    // Index the active trips by vessel abbreviation
    activeTripsByVesselAbbrev: indexActiveTripsByVesselAbbrev(activeTrips),
    // Index the physical-only trips
    physicalOnlyTrips: [...activeTrips, ...completedTrips].filter(
      (trip) => trip.ScheduleKey === undefined
    ),
  };
};
