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
 * Reads every matching row via `by_vessel_and_sailing_day`, strips Convex
 * metadata with `stripConvexMeta`, then sorts so the sequence matches the
 * scheduled backbone `mergeTimelineRows` sees before it merges actuals and
 * predictions.
 *
 * Sorting delegates to `sortScheduledDockEvents` in
 * `domain/timelineRows/scheduledSegmentResolvers` (the same comparator
 * `mergeTimelineRows` applies to its scheduled input). Primary order is boundary
 * time from `getBoundaryTime`: `EventScheduledTime` when present, otherwise
 * `ScheduledDeparture`. Ties break by event type (`arv-dock` before `dep-dock`),
 * then by `TerminalAbbrev` lexicographically. Sharing this comparator keeps list
 * queries, backbone builders, and reseed paths aligned on one timeline ordering.
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
 * Public Convex query listing scheduled dock events for one vessel and sailing
 * day.
 *
 * Validates arguments and return shape with Convex validators, then delegates
 * to `readScheduledDockEventsForVesselSailingDay`. Realtime clients subscribe
 * here for planned boundary updates without coupling to internal loader names.
 *
 * Returned rows use the same ordering as
 * `readScheduledDockEventsForVesselSailingDay` (`sortScheduledDockEvents`,
 * shared with `mergeTimelineRows`), so UI timelines stay consistent with
 * server-side merged event lists for the same vessel and day.
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
