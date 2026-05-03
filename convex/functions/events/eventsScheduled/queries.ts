/**
 * Reads from `eventsScheduled`: the scheduled backbone (planned dock times and
 * terminal sequence) that trips and timelines overlay with actuals and
 * predictions.
 */

import type { QueryCtx } from "_generated/server";
import { stripConvexMeta } from "shared/stripConvexMeta";
import type { ConvexScheduledDockEvent } from "./schemas";

/**
 * Returns every scheduled dock row for one `VesselAbbrev` and sailing day.
 *
 * Rows are planned departures and arrivals for that calendar day. Strips Convex
 * metadata so callers receive plain objects matching `eventsScheduledSchema`.
 *
 * @param ctx - Convex query context (database handle)
 * @param args.vesselAbbrev - Vessel abbreviation (`VesselAbbrev` column)
 * @param args.sailingDay - Calendar sailing day `YYYY-MM-DD`
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
