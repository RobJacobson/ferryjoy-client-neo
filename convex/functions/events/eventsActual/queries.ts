/**
 * Internal persistence queries for normalized actual dock events.
 */

import type { QueryCtx } from "_generated/server";
import type { ConvexActualDockEvent } from "./schemas";

/**
 * Loads all actual dock events for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param args.vesselAbbrev - Vessel abbreviation
 * @param args.sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Same-day actual dock events for that vessel
 */
export const loadActualDockEventsForVesselSailingDay = async (
  ctx: Pick<QueryCtx, "db">,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexActualDockEvent[]> =>
  ctx.db
    .query("eventsActual")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", args.sailingDay)
    )
    .collect();
