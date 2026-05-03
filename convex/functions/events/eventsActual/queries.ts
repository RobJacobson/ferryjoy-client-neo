/**
 * Queries the `eventsActual` table: observed dock boundaries (times and legs)
 * that timelines and route overlays merge with `eventsScheduled` and
 * `eventsPredicted`.
 */

import type { Doc } from "_generated/dataModel";
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
 * Returns every `eventsActual` row for one `VesselAbbrev` and sailing day.
 *
 * Each row is one dock-side event (scheduled departure instant, terminal,
 * observed time when known). Downstream code merges this table with
 * `eventsScheduled` and `eventsPredicted` so the app can show actual vs
 * scheduled vs ML/ETA predictions for the same leg.
 *
 * @param ctx - Convex query context (database handle)
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Full `eventsActual` documents (includes Convex metadata)
 */
const loadActualDockEventsForVesselSailingDay = async (
  ctx: Pick<QueryCtx, "db">,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<Doc<"eventsActual">[]> =>
  ctx.db
    .query("eventsActual")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", args.sailingDay)
    )
    .collect();

/**
 * Lists actual dock events for one vessel and sailing day for clients.
 *
 * Reads via `by_vessel_and_sailing_day`, strips `_id` and `_creationTime`,
 * then sorts by ascending `ScheduledDeparture`, then ascending `EventKey`
 * (lexicographic).
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
  handler: async (ctx, args) => {
    const docs = await loadActualDockEventsForVesselSailingDay(ctx, args);
    return docs.map(stripConvexMeta).sort(sortActualDockEventsForPublicList);
  },
});

export {
  listActualDockEventsForVesselSailingDay,
  loadActualDockEventsForVesselSailingDay,
  sortActualDockEventsForPublicList,
};
