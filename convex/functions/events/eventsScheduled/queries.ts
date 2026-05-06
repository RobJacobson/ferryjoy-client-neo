/**
 * Convex queries for eventsScheduled.
 *
 * Scheduled dock rows are read by client subscriptions and by the vessel
 * orchestrator schedule lookup path. This module keeps the indexed read and
 * deterministic timeline ordering table-local.
 */

import type { QueryCtx } from "_generated/server";
import { query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "shared/stripConvexMeta";
import {
  type ConvexScheduledDockEvent,
  eventsScheduledSchema,
} from "./schemas";

type ScheduledQueryArgs = {
  vesselAbbrev: string;
  sailingDay: string;
};

/**
 * Loads scheduled dock rows for one vessel and sailing day.
 *
 * Uses the vessel/day index, removes Convex document metadata, and applies the
 * local scheduled ordering required by timeline reads and orchestrator rollover
 * pools. Arrival rows sort before departure rows when their boundary times are
 * equal.
 *
 * @param ctx - Convex read context exposing database access
 * @param args - Vessel and sailing-day filters
 * @returns Validator-shaped scheduled rows in deterministic timeline order
 */
const readScheduledDockEventsForVesselSailingDay = async (
  ctx: Pick<QueryCtx, "db">,
  args: ScheduledQueryArgs
): Promise<ConvexScheduledDockEvent[]> => {
  const docs = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", args.sailingDay)
    )
    .collect();

  return docs.map(stripConvexMeta).sort(sortScheduledDockEvents);
};

/**
 * Public query listing scheduled dock events for a vessel/day scope.
 *
 * Delegates to the internal reader so production lookups and client
 * subscriptions share exactly the same index use, metadata stripping, and
 * ordering.
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
 * Sorts scheduled dock rows in stable chronological order.
 *
 * EventScheduledTime carries the boundary instant when present; ScheduledDeparture
 * is the stable fallback. Arrival-before-departure ties keep a vessel arriving
 * at a dock before the next departure from that same boundary.
 *
 * @param left - First scheduled dock row
 * @param right - Second scheduled dock row
 * @returns Numeric sort result
 */
const sortScheduledDockEvents = (
  left: ConvexScheduledDockEvent,
  right: ConvexScheduledDockEvent
): number =>
  getScheduledBoundaryTime(left) - getScheduledBoundaryTime(right) ||
  getScheduledEventTypeRank(left) - getScheduledEventTypeRank(right) ||
  left.ScheduledDeparture - right.ScheduledDeparture ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev) ||
  left.Key.localeCompare(right.Key);

/**
 * Resolves the comparable boundary time for a scheduled dock row.
 *
 * @param row - Scheduled dock row to compare
 * @returns EventScheduledTime when present, otherwise ScheduledDeparture
 */
const getScheduledBoundaryTime = (row: ConvexScheduledDockEvent): number =>
  row.EventScheduledTime ?? row.ScheduledDeparture;

/**
 * Ranks arrivals before departures for equal scheduled boundary times.
 *
 * @param row - Scheduled dock row to rank
 * @returns Zero for arrivals and one for departures
 */
const getScheduledEventTypeRank = (row: ConvexScheduledDockEvent): number =>
  row.EventType === "arv-dock" ? 0 : 1;

export {
  listScheduledDockEventsForVesselSailingDay,
  readScheduledDockEventsForVesselSailingDay,
};
