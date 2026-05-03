/**
 * Queries the `eventsActual` table: observed dock boundaries (times and legs)
 * that timelines and route overlays merge with `eventsScheduled` and
 * `eventsPredicted`.
 */

import type { QueryCtx } from "_generated/server";
import type { ConvexActualDockEvent } from "./schemas";

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
