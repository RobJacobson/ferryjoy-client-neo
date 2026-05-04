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
 * Internal mutation entrypoint for reloading scheduled and actual dock rows atomically.
 *
 * Validates dock-boundary payloads against dockBoundaryEventRecordSchema before invoking
 * replaceDockEventsForSailingDayRows so malformed reload batches fail fast server-side.
 *
 * @param ctx - Convex internal mutation context
 * @param args.SailingDay - Service day being replaced
 * @param args.Events - Boundary records built by hydrateActualDockEvents upstream
 * @returns ScheduledCount and ActualCount returned by the replacement helper
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
