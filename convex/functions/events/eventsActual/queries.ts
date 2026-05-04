/**
 * Queries the eventsActual table: observed dock boundaries (times and legs)
 * that events and route overlays merge with eventsScheduled and
 * eventsPredicted.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { type ConvexActualDockEvent, eventsActualSchema } from "./schemas";

/**
 * Comparator that orders actual dock rows for client-facing lists.
 *
 * Primary sort is ScheduledDeparture ascending so timelines read chronologically;
 * EventKey breaks ties when multiple boundaries share the same scheduled depart instant.
 *
 * @param left - First row after Convex metadata stripping
 * @param right - Second row after Convex metadata stripping
 * @returns Negative when left sorts before right
 */
const sortActualDockEventsForPublicList = (
  left: ConvexActualDockEvent,
  right: ConvexActualDockEvent
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  left.EventKey.localeCompare(right.EventKey);

/**
 * Loads actual dock rows for one vessel and sailing day from Convex storage.
 *
 * Uses the by_vessel_and_sailing_day index for efficient scoped reads, strips
 * Convex metadata fields for validator-shaped payloads, then sorts deterministically
 * so subscribers receive stable ordering across reactive updates.
 *
 * @param ctx - Convex query context exposing db
 * @param args.vesselAbbrev - VesselAbbrev column filter
 * @param args.sailingDay - Calendar sailing day YYYY-MM-DD
 * @returns Plain objects matching eventsActualSchema sorted for presentation
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
 * Public Convex query wrapper listing actual dock events for vessel scope.
 *
 * Validates arguments and return arrays at the Convex boundary so clients cannot
 * bypass schema checks; delegates row loading to readActualDockEventsForVesselSailingDay.
 *
 * @param ctx - Convex query context including authenticated actor when configured
 * @param args.vesselAbbrev - VesselAbbrev column filter
 * @param args.sailingDay - Calendar sailing day YYYY-MM-DD
 * @returns Validator-shaped rows sorted by sortActualDockEventsForPublicList
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
