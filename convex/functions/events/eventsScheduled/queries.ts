/**
 * Convex queries for eventsScheduled: planned dock boundary rows per vessel
 * and sailing day. Trip loaders, reload helpers, and client subscriptions use
 * these readers for stable boundary ordering.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { sortScheduledDockEvents } from "domain/events/scheduled/scheduledSegmentResolvers";
import { stripConvexMeta } from "shared/stripConvexMeta";
import {
  type ConvexScheduledDockEvent,
  eventsScheduledSchema,
} from "./schemas";

/**
 * Loads scheduled dock boundary rows for one vessel and sailing day.
 *
 * Collects with by_vessel_and_sailing_day, strips Convex metadata, then applies
 * sortScheduledDockEvents so arrival-before-departure ties and terminal ordering
 * match domain resolvers used during reload and inference.
 *
 * @param ctx - Convex read context exposing db
 * @param args.vesselAbbrev - VesselAbbrev column value
 * @param args.sailingDay - Calendar sailing day YYYY-MM-DD
 * @returns Rows matching eventsScheduledSchema in deterministic timeline order
 */
const readScheduledDockEventsForVesselSailingDay = async (
  ctx: { db: QueryCtx["db"] },
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexScheduledDockEvent[]> => {
  const rows = (
    await ctx.db
      .query("eventsScheduled")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.vesselAbbrev)
          .eq("SailingDay", args.sailingDay)
      )
      .collect()
  ).map(stripConvexMeta);
  return rows.sort(sortScheduledDockEvents);
};

/**
 * Public Convex query listing scheduled dock events for vessel scope.
 *
 * Wraps readScheduledDockEventsForVesselSailingDay with Convex argument and return
 * validators so clients receive schema-checked payloads identical to internal callers.
 *
 * @param ctx - Convex query context including db access
 * @param args.vesselAbbrev - VesselAbbrev column value
 * @param args.sailingDay - Calendar sailing day YYYY-MM-DD
 * @returns Validator-shaped scheduled rows sorted for stable subscriptions
 */
const listScheduledDockEventsForVesselSailingDay = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsScheduledSchema),
  handler: async (ctx, args) =>
    readScheduledDockEventsForVesselSailingDay(ctx, args),
});

export {
  listScheduledDockEventsForVesselSailingDay,
  readScheduledDockEventsForVesselSailingDay,
};
