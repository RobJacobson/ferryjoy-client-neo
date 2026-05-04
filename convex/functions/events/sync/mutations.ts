/**
 * Internal mutations for replacing dock-event table slices.
 *
 * The mutation layer validates reload payloads, loads persistence context, and
 * delegates row construction to domain event helpers before writing tables.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { replaceDockEventsForSailingDayRows } from "./replaceDockEventsForSailingDay";
import { dockBoundaryEventRecordSchema } from "./schemas";

/**
 * Replaces scheduled and actual dock-event rows for one sailing day.
 *
 * @param ctx - Convex internal mutation context
 * @param args.SailingDay - Service day being replaced
 * @param args.Events - Boundary records already normalized in memory
 * @returns Counts for scheduled vs actual rows written for that slice
 */
const replaceDockEventsForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(dockBoundaryEventRecordSchema),
  },
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
  handler: async (ctx, args) => replaceDockEventsForSailingDayRows(ctx, args),
});

export { replaceDockEventsForSailingDay };
