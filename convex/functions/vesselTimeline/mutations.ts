/**
 * Internal mutations for the normalized VesselTimeline boundary-event tables.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { runReseedBoundaryEventsForSailingDay } from "./reseed";
import { vesselTimelineEventRecordSchema } from "./schemas";

/**
 * Reseeds scheduled and actual vessel-timeline boundary rows for one sailing day.
 *
 * Schedule sync drives this mutation: the `Events` slice is authoritative for
 * that day’s scheduled backbone, while `eventsActual` replacement retains legacy
 * physical-only keys as documented on `replaceActualRowsForSailingDay`.
 *
 * @param ctx - Convex internal mutation context
 * @param args.SailingDay - Service day being fully replaced
 * @param args.Events - Boundary events already normalized in memory
 * @returns Counts for scheduled vs actual rows written for that slice
 */
export const reseedBoundaryEventsForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(vesselTimelineEventRecordSchema),
  },
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
  handler: async (ctx, args) => runReseedBoundaryEventsForSailingDay(ctx, args),
});
