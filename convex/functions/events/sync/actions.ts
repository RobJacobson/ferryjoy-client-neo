/**
 * Registers Convex actions for reloading dock-event tables.
 *
 * Public actions support manual operator reloads, while internal actions back
 * cron and windowed recovery workflows.
 */

import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import { getPacificTimeComponents, getSailingDay } from "../../../shared/time";
import { runReloadDockEventsForSailingDay } from "./reloadDockEventsForSailingDay";
import { runReloadDockEventsWindow } from "./reloadDockEventsWindow";
import type { EventReloadResult, WindowReloadDayResult } from "./types";

/**
 * Reloads dock-event rows for today’s Pacific sailing day.
 *
 * @param ctx - Convex public action context
 * @returns Scheduled and actual row counts written for today
 */
const reloadDockEventsForCurrentSailingDay = action({
  args: {},
  handler: async (ctx): Promise<EventReloadResult> => {
    const sailingDay = getSailingDay(new Date());
    return await runReloadDockEventsForSailingDay(ctx, sailingDay);
  },
});

/**
 * Reloads dock-event rows for one requested sailing day.
 *
 * @param ctx - Convex public action context
 * @param args - Action arguments containing the target sailing day
 * @returns Scheduled and actual row counts written for the requested date
 */
const reloadDockEventsForSailingDay = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args): Promise<EventReloadResult> =>
    await runReloadDockEventsForSailingDay(ctx, args.targetDate),
});

/**
 * Reloads a sliding window of consecutive sailing days starting from today.
 *
 * @param ctx - Convex internal action context
 * @param args - Action arguments containing an optional day-count override
 * @returns Aggregate scheduled and actual row counts for the processed window
 */
const reloadDockEventsWindow = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, args) =>
    await runReloadDockEventsWindow(ctx, args.daysToSync),
});

/**
 * Runs the windowed reload near the Pacific 3am sailing-day boundary.
 *
 * @param ctx - Convex internal action context
 * @param args - Action arguments containing an optional day-count override
 * @returns Skip metadata or aggregate counts for the processed window
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
