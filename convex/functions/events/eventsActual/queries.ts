/**
 * Convex queries for eventsActual.
 *
 * Actual dock rows are indexed by vessel and sailing day for timeline
 * subscriptions. The public list query returns plain validator-shaped rows in a
 * deterministic order.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { type ConvexActualDockEvent, eventsActualSchema } from "./schemas";

/**
 * Public query listing actual dock events for a vessel/day scope.
 *
 * @param ctx - Convex query context
 * @param args - Vessel and sailing-day filters
 * @returns Actual dock rows sorted by scheduled departure then event key
 */
const listActualDockEventsForVesselSailingDay = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsActualSchema),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("eventsActual")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.vesselAbbrev)
          .eq("SailingDay", args.sailingDay)
      )
      .collect();

    return docs.map(stripConvexMeta).sort(sortActualDockEventsForPublicList);
  },
});

/**
 * Sorts actual dock rows for public list responses.
 *
 * @param left - First actual dock row
 * @param right - Second actual dock row
 * @returns Numeric sort result
 */
const sortActualDockEventsForPublicList = (
  left: ConvexActualDockEvent,
  right: ConvexActualDockEvent
): number =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  left.EventKey.localeCompare(right.EventKey);

export { listActualDockEventsForVesselSailingDay };
