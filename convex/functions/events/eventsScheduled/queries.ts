/**
 * Internal persistence queries for normalized scheduled dock events.
 */

import type { QueryCtx } from "_generated/server";
import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { buildBoundaryKey } from "shared/keys";
import { stripConvexMeta } from "shared/stripConvexMeta";
import type { ConvexScheduledDockEvent } from "./schemas";
import { eventsScheduledSchema } from "./schemas";

/**
 * Loads all scheduled dock events for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param args.vesselAbbrev - Vessel abbreviation
 * @param args.sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Same-day scheduled dock events for that vessel
 */
export const queryScheduledDockEventsForVesselSailingDay = async (
  ctx: { db: QueryCtx["db"] },
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexScheduledDockEvent[]> =>
  (
    await ctx.db
      .query("eventsScheduled")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.vesselAbbrev)
          .eq("SailingDay", args.sailingDay)
      )
      .collect()
  ).map(stripConvexMeta);

/**
 * Loads all scheduled dock events for one vessel and sailing day.
 *
 * @param args.vesselAbbrev - Vessel abbreviation
 * @param args.sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Same-day scheduled dock events for that vessel
 */
export const getScheduledDockEventsForSailingDay = internalQuery({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsScheduledSchema),
  handler: async (ctx, args): Promise<ConvexScheduledDockEvent[]> =>
    queryScheduledDockEventsForVesselSailingDay(ctx, args),
});

/**
 * Loads one scheduled departure dock event by its stable segment key.
 *
 * @param args.segmentKey - Canonical segment key shared with `vesselTrips`
 * @returns The matching departure row, or `null`
 */
export const getScheduledDepartureEventBySegmentKey = internalQuery({
  args: {
    segmentKey: v.string(),
  },
  returns: v.union(eventsScheduledSchema, v.null()),
  handler: async (ctx, args) => {
    const departureEvent = await ctx.db
      .query("eventsScheduled")
      .withIndex("by_key", (q) =>
        q.eq("Key", buildBoundaryKey(args.segmentKey, "dep-dock"))
      )
      .unique();

    return departureEvent ? stripConvexMeta(departureEvent) : null;
  },
});
