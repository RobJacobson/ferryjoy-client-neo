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
import {
  reloadDockDataSchema,
  reloadDockScheduleDataSchema,
} from "./reloadDockDataSchemas";
import {
  reloadActualDockEventsForSailingDayRows,
  replaceDockEventsForSailingDayRows,
  replaceScheduledDockEventsForSailingDayRows,
} from "./replaceDockEventsForSailingDay";

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

/**
 * Internal mutation entrypoint for reloading scheduled dock rows only.
 *
 * Validates the schedule payload before invoking the scheduled table helper so
 * schedule replacement can run independently from actual observation refresh.
 *
 * @param ctx - Convex internal mutation context
 * @param args.ReloadDockScheduleData - Validated schedule payload
 * @returns ScheduledCount returned by the scheduled replacement helper
 */
const replaceScheduledDockEventsForSailingDay = internalMutation({
  args: {
    ReloadDockScheduleData: reloadDockScheduleDataSchema,
  },
  returns: v.object({
    ScheduledCount: v.number(),
  }),
  handler: async (ctx, args) =>
    replaceScheduledDockEventsForSailingDayRows(ctx, args),
});

/**
 * Internal mutation entrypoint for reloading actual dock rows only.
 *
 * Validates the schedule and history payload before invoking the actual table
 * helper so physical observations upsert without replacing scheduled rows.
 *
 * @param ctx - Convex internal mutation context
 * @param args.ReloadDockData - Validated payload of schedule segments and vessel history rows
 * @returns ActualCount returned by the actual reload helper
 */
const reloadActualDockEventsForSailingDay = internalMutation({
  args: {
    ReloadDockData: reloadDockDataSchema,
  },
  returns: v.object({
    ActualCount: v.number(),
  }),
  handler: async (ctx, args) =>
    reloadActualDockEventsForSailingDayRows(ctx, args),
});

export {
  reloadActualDockEventsForSailingDay,
  replaceDockEventsForSailingDay,
  replaceScheduledDockEventsForSailingDay,
};
