/**
 * Convex actions for static dock-event table reloads.
 *
 * Public actions support manual operator reloads; internal actions support
 * cron-safe sailing-day boundary and recovery-window workflows.
 */

import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import type { ReloadDockDayCountResult } from "domain/events/reload/reseedDockBoundarySchemas";
import { getPacificTimeComponents, getSailingDay } from "shared/time";
import { runReloadDockEventsForSailingDay } from "./reloadDockEventsForSailingDay";
import {
  runReloadDockEventsWindow,
  type WindowReloadDayResult,
} from "./reloadDockEventsWindow";

/**
 * Reloads dock-event rows for the current sailing day.
 *
 * @param ctx - Convex action context
 * @returns Scheduled and actual counts for the current sailing day
 */
const reloadDockEventsForCurrentSailingDay = action({
  args: {},
  handler: async (ctx): Promise<ReloadDockDayCountResult> => {
    const sailingDay = getSailingDay(new Date());
    return await runReloadDockEventsForSailingDay(ctx, sailingDay);
  },
});

/**
 * Reloads dock-event rows for an explicit sailing day.
 *
 * @param ctx - Convex action context
 * @param args.targetDate - Target YYYY-MM-DD sailing day
 * @returns Scheduled and actual counts for the target sailing day
 */
const reloadDockEventsForSailingDay = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args): Promise<ReloadDockDayCountResult> =>
    await runReloadDockEventsForSailingDay(ctx, args.targetDate),
});

/**
 * Reloads a consecutive window of sailing days.
 *
 * @param ctx - Convex internal action context
 * @param args.daysToSync - Optional number of sailing days to reload
 * @returns Aggregated reload counts for the processed window
 */
const reloadDockEventsWindow = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx, args) =>
    await runReloadDockEventsWindow(ctx, args.daysToSync),
});

/**
 * Runs the boundary reload only during Pacific hour three.
 *
 * @param ctx - Convex internal action context
 * @param args.daysToSync - Optional number of sailing days to reload
 * @returns Skip metadata outside the window or aggregate reload counts
 */
const reloadDockEventsAtSailingDayBoundary = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const pacificNow = getPacificTimeComponents(new Date());

    if (pacificNow.hour !== 3) {
      return {
        skipped: true,
        reason: "outside_pacific_3am_window",
        totalScheduled: 0,
        totalActual: 0,
        daysProcessed: [] as WindowReloadDayResult[],
      };
    }

    return {
      skipped: false,
      ...(await runReloadDockEventsWindow(ctx, args.daysToSync)),
    };
  },
});

export {
  reloadDockEventsAtSailingDayBoundary,
  reloadDockEventsForCurrentSailingDay,
  reloadDockEventsForSailingDay,
  reloadDockEventsWindow,
};
