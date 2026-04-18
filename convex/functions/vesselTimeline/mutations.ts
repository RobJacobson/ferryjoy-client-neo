/**
 * Internal mutations for the normalized VesselTimeline boundary-event tables.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { runReseedBoundaryEventsForSailingDay } from "./reseed";
import { vesselTimelineEventRecordSchema } from "./schemas";

/**
 * Reseeds the structural scheduled backbone and hydrated actual rows for one
 * sailing day.
 *
 * Schedule sync owns this mutation. It treats the supplied day slice as the
 * complete truth for scheduled rows; `eventsActual` uses supersession by
 * `EventKey` and retains physical-only rows not in the new slice.
 *
 * @param args.SailingDay - Service day being fully replaced
 * @param args.Events - Boundary events already normalized in memory
 * @returns Counts for the rows represented by that replaced slice
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
