/**
 * Internal mutations for replacing dock-event table slices.
 *
 * The mutation layer validates reload payloads at the Convex boundary and
 * delegates the schedule-to-rows pipeline to replaceDockEventsForSailingDayRows.
 * Validating the entire ConvexReloadDockData payload (schedule segments plus
 * vessel history slices) lets the mutation own the merge stages locally so
 * malformed reload batches fail fast server-side.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { reloadDockDataSchema } from "./reloadDockDataSchemas";
import { replaceDockEventsForSailingDayRows } from "./replaceDockEventsForSailingDay";

/**
 * Internal mutation entrypoint for reloading scheduled and actual dock rows atomically.
 *
 * Validates the reload payload against reloadDockDataSchema before invoking
 * replaceDockEventsForSailingDayRows, which restores Date instants, loads
 * persistence context, composes hydrated transitions, and writes both event
 * tables in one transaction.
 *
 * @param ctx - Convex internal mutation context
 * @param args.ReloadDockData - Validated payload of schedule segments and vessel history rows
 * @returns ScheduledCount and ActualCount returned by the replacement helper
 */
const replaceDockEventsForSailingDay = internalMutation({
  args: {
    ReloadDockData: reloadDockDataSchema,
  },
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
  handler: async (ctx, args) => replaceDockEventsForSailingDayRows(ctx, args),
});

export { replaceDockEventsForSailingDay };
