/**
 * Convex actions for static dock-event table reloads.
 *
 * Public actions support manual operator reloads; internal actions support
 * cron-safe sailing-day boundary and recovery-window workflows.
 */

import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import type { ReloadDockDayCountResult } from "domain/events/reload/schemas";
import { getPacificTimeComponents, getSailingDay } from "shared/time";
import { runReloadDockEventsForSailingDay } from "./reloadDockEventsForSailingDay";
import {
  runReloadDockEventsWindow,
  type WindowReloadDayResult,
} from "./reloadDockEventsWindow";

/**
 * Reloads dock-event rows for the current sailing day.
 *
 * Operators trigger this action from the admin surface to refresh today's
 * scheduled and actual rows when something looks stale. The current sailing
 * day is computed from the wall clock through the shared Pacific calendar
 * helper so the action does not depend on a caller-supplied date, which
 * keeps it safe to wire to one-click admin buttons.
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
 * Operators and recovery scripts call this action when they need to refresh
 * a specific sailing day rather than the current one, for example after a
 * WSF outage backfills history. The handler delegates to the same shared
 * runner used by the current-day action so behavior stays identical apart
 * from the caller-supplied date.
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
 * Crons and recovery workflows call this internal action to refresh several
 * consecutive sailing days in one pass without scheduling separate per-day
 * jobs. The implementation walks the window sequentially through the shared
 * runner so each day still receives a clean transactional reseed while the
 * aggregate counts roll up for monitoring.
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
 * The cron schedule fires every hour, but the sailing-day boundary reload is
 * only valid during the small window after midnight Pacific when the day
 * rolls over. This wrapper gates the window runner on Pacific hour three so
 * the cron can be unconditional, and the action self-skips with a metadata
 * payload outside the window for clear monitoring.
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
