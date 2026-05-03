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
 * Loads trip rows for one sailing day and builds reseed lookup indexes.
 *
 * Queries `activeVesselTrips` and `completedVesselTrips` by sailing-day indexes,
 * then builds segment-key and vessel maps plus a physical-only trip list for
 * `buildReseedTimelineSlice`.
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
