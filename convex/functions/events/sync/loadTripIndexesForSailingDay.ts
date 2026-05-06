/**
 * Loads vessel trip rows for a sailing day and builds indexes used during
 * dock-event reload.
 */

import type { MutationCtx } from "_generated/server";
import {
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
} from "domain/events/actual";

/**
 * Loads trip rows for one sailing day and builds reload lookup indexes.
 *
 * Active trips supply scheduleless reconciliation targets; completed trips extend
 * segment-key coverage for legs that finished earlier in the day. physicalOnlyTrips
 * filters both collections to ScheduleKey undefined rows used when synthesizing bare
 * TripKey actuals without scheduled anchors.
 *
 * @param ctx - Convex mutation context for database reads
 * @param sailingDay - Target calendar sailing day string
 * @returns tripBySegmentKey, activeTripsByVesselAbbrev, and physicalOnlyTrips for reload
 */
export const loadTripIndexesForSailingDay = async (
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
