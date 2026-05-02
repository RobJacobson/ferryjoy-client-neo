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
 * Strips Convex metadata via `stripConvexMeta` so callers receive validator-shaped
 * documents for timeline and route snapshot code.
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
 * Exposes the same read through generated args/returns validators so actions and
 * crons can call it without importing the helper directly.
 *
 * @param ctx - Convex query context
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
 * Resolves `dep-dock` boundary keys via `buildBoundaryKey` so trip continuity
 * lookups align with `eventsScheduled` indexing.
 *
 * @param ctx - Convex query context
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
