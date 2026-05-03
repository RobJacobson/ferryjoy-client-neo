/**
 * Reads from `eventsScheduled`: the scheduled backbone (planned dock times and
 * terminal sequence) that trips and timelines overlay with actuals and
 * predictions.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { sortScheduledDockEvents } from "domain/timelineRows/scheduledSegmentResolvers";
import { stripConvexMeta } from "shared/stripConvexMeta";
import {
  type ConvexScheduledDockEvent,
  eventsScheduledSchema,
} from "./schemas";

/**
 * Returns every scheduled dock row for one `VesselAbbrev` and sailing day.
 *
 * Rows are planned departures and arrivals for that calendar day. Strips Convex
 * metadata so callers receive plain objects matching `eventsScheduledSchema`.
 *
 * @param ctx - Convex query context (database handle)
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Scheduled dock rows for the vessel/day without `_id` or `_creationTime`
 */
const queryScheduledDockEventsForVesselSailingDay = async (
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
 * Lists scheduled dock events for one vessel and sailing day for clients.
 *
 * Reads via `by_vessel_and_sailing_day`, strips Convex metadata, then sorts
 * with the same comparator as `mergeTimelineRows` for scheduled rows:
 * boundary time (`EventScheduledTime` or `ScheduledDeparture`), then
 * `EventType` order (`arv-dock` before `dep-dock`), then `TerminalAbbrev`
 * lexicographically.
 *
 * @param ctx - Convex query context
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Validator-shaped scheduled rows in stable timeline order
 */
const listScheduledDockEventsForVesselSailingDay = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsScheduledSchema),
  handler: async (ctx, args) => {
    const rows = await queryScheduledDockEventsForVesselSailingDay(ctx, args);
    return rows.sort(sortScheduledDockEvents);
  },
});

export {
  listScheduledDockEventsForVesselSailingDay,
  queryScheduledDockEventsForVesselSailingDay,
};
