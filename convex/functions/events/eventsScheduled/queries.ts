/**
 * Convex queries for `eventsScheduled`: planned dock boundary rows per vessel
 * and sailing day. Consumers include trip schedule loaders, timeline backbone
 * assembly, and client subscriptions that need the same ordering that merge
 * logic uses before actual and predicted overlays attach.
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
 * Loads scheduled dock boundary rows for one vessel and sailing day.
 *
 * Collects via `by_vessel_and_sailing_day`, strips Convex metadata with
 * `stripConvexMeta`, then sorts with `sortScheduledDockEvents` from
 * `domain/timelineRows/scheduledSegmentResolvers`—the same ordering
 * `mergeTimelineRows` applies to scheduled rows—so this read matches backbone and
 * reseed paths. Order uses `getBoundaryTime` (`EventScheduledTime` or else
 * `ScheduledDeparture`), then `arv-dock` before `dep-dock`, then
 * `TerminalAbbrev`.
 *
 * @param ctx - Convex read context exposing `db`
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
 * @returns Rows matching `eventsScheduledSchema` in stable timeline order
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
 * Public Convex query listing scheduled dock events for one vessel and sailing day.
 *
 * Validates `args` and `returns` with Convex validators, then calls
 * `readScheduledDockEventsForVesselSailingDay`, so subscribers get the same
 * ordered planned boundaries as merge/backbone code without importing the
 * internal reader.
 *
 * @param ctx - Convex query context (database handle)
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
  handler: async (ctx, args) =>
    readScheduledDockEventsForVesselSailingDay(ctx, args),
});

export {
  listScheduledDockEventsForVesselSailingDay,
  readScheduledDockEventsForVesselSailingDay,
};
