/**
 * Reads scheduled dock events by vessel and sailing day.
 *
 * The app subscribes through the public query while vessel-trip continuity code
 * imports the same reader directly, so both paths share one indexed read and
 * timeline ordering contract.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "shared/stripConvexMeta";
import {
  type ConvexScheduledDockEvent,
  eventsScheduledSchema,
} from "./schemas";

/**
 * Loads scheduled dock rows for one vessel and sailing day.
 *
 * @param ctx - Convex read context exposing database access
 * @param args - Vessel and sailing-day filters
 * @returns Validator-shaped scheduled rows in deterministic timeline order
 */
const readScheduledDockEventsForVesselSailingDay = async (
  ctx: Pick<QueryCtx, "db">,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexScheduledDockEvent[]> => {
  const docs = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", args.sailingDay)
    )
    .collect();

  return docs.map(stripConvexMeta).sort(compareScheduledDockEvents);
};

/**
 * Public query listing scheduled dock events for a vessel/day scope.
 *
 * @param ctx - Convex query context
 * @param args - Vessel and sailing-day filters
 * @returns Scheduled dock rows sorted in timeline order
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

/**
 * Compares scheduled dock rows by timeline order.
 *
 * @param left - First scheduled dock row
 * @param right - Second scheduled dock row
 * @returns Numeric sort result
 */
const compareScheduledDockEvents = (
  left: ConvexScheduledDockEvent,
  right: ConvexScheduledDockEvent
): number =>
  (left.EventScheduledTime ?? left.ScheduledDeparture) -
    (right.EventScheduledTime ?? right.ScheduledDeparture) ||
  (left.EventType === "arv-dock" ? 0 : 1) -
    (right.EventType === "arv-dock" ? 0 : 1) ||
  left.ScheduledDeparture - right.ScheduledDeparture ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev) ||
  left.Key.localeCompare(right.Key);

export {
  listScheduledDockEventsForVesselSailingDay,
  readScheduledDockEventsForVesselSailingDay,
};
