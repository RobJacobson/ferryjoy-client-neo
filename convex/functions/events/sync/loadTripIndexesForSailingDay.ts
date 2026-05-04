/**
 * Loads vessel trip rows for a sailing day and builds indexes used during
 * dock-event reload.
 */

import type { MutationCtx } from "_generated/server";
import {
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
} from "domain/events";

/**
 * Loads trip rows for one sailing day and builds reload lookup indexes.
 *
 * Queries `activeVesselTrips` and `completedVesselTrips` by sailing-day indexes,
 * then builds segment-key and vessel maps plus a physical-only trip list for
 * `buildDockEventRowsForSailingDayReload`.
 *
 * @param ctx - Mutation context
 * @param sailingDay - Target sailing day
 * @returns Trip maps and physical-only trips for actual-event reconciliation
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
