/**
 * Queries the `eventsActual` table: observed dock boundaries (times and legs)
 * that timelines and route overlays merge with `eventsScheduled` and
 * `eventsPredicted`.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { type ConvexActualDockEvent, eventsActualSchema } from "./schemas";

/**
 * Compares two actual dock events for stable public list ordering.
 *
 * @param left - First row (after metadata strip)
 * @param right - Second row (after metadata strip)
 * @returns Sort comparison for ascending `ScheduledDeparture`, then `EventKey`
 */
const sortActualDockEventsForPublicList = (
  left: ConvexActualDockEvent,
  right: ConvexActualDockEvent
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  left.EventKey.localeCompare(right.EventKey);

/**
 * Reads actual dock rows for one vessel and sailing day: index collect, strips
 * metadata, then sorts by ascending `ScheduledDeparture`, then `EventKey`.
 *
 * @param ctx - Convex query context (database handle)
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Validator-shaped actual rows in deterministic order
 */
const readActualDockEventsForVesselSailingDay = async (
  ctx: Pick<QueryCtx, "db">,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexActualDockEvent[]> => {
  const docs = await ctx.db
    .query("eventsActual")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", args.sailingDay)
    )
    .collect();
  return docs.map(stripConvexMeta).sort(sortActualDockEventsForPublicList);
};

/**
 * Lists actual dock events for one vessel and sailing day for clients.
 *
 * @param ctx - Convex query context
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Validator-shaped actual rows in deterministic order
 */
const listActualDockEventsForVesselSailingDay = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsActualSchema),
  handler: async (ctx, args) =>
    readActualDockEventsForVesselSailingDay(ctx, args),
});

export {
  listActualDockEventsForVesselSailingDay,
  readActualDockEventsForVesselSailingDay,
  sortActualDockEventsForPublicList,
};
