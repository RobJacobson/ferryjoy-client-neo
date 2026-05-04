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
 * Operator-facing reload for the current calendar sailing day in app time.
 *
 * Derives today via getSailingDay from the action invocation clock, then reuses
 * the same single-day pipeline as manual date-specific reloads.
 *
 * @param ctx - Convex public action context for auth and scheduled mutation calls
 * @returns Scheduled and actual row counts from the internal replacement mutation
 */
const reloadDockEventsForCurrentSailingDay = action({
  args: {},
  handler: async (ctx): Promise<EventReloadResult> => {
    const sailingDay = getSailingDay(new Date());
    return await runReloadDockEventsForSailingDay(ctx, sailingDay);
  },
});

/**
 * Operator-facing reload for an explicit YYYY-MM-DD sailing day.
 *
 * Accepts targetDate as a string so JSON action calls stay simple; delegates to
 * runReloadDockEventsForSailingDay for adapter fetch, hydration, and mutation handoff.
 *
 * @param ctx - Convex public action context
 * @param args.targetDate - Sailing day string passed to schedule and history fetches
 * @returns Scheduled and actual row counts written for that date
 */
const reloadDockEventsForSailingDay = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args): Promise<EventReloadResult> =>
    await runReloadDockEventsForSailingDay(ctx, args.targetDate),
});

/**
 * Internal action that reloads a consecutive multi-day window starting today.
 *
 * Intended for recovery jobs; forwards optional day count to runReloadDockEventsWindow
 * so cron can widen or narrow the catch-up span without duplicating orchestration code.
 *
 * @param ctx - Convex internal action context
 * @param args.daysToSync - Optional day count override for the reload window
 * @returns Aggregated totals and per-day summaries from the window helper
 */
const reloadDockEventsWindow = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, args) =>
    await runReloadDockEventsWindow(ctx, args.daysToSync),
});

/**
 * Cron-safe window reload gated on Pacific hour three for sailing-day turnover.
 *
 * Skips work outside the 3am Pacific window so duplicate scheduler ticks do not hammer
 * adapters; returns structured skip metadata instead of throwing when not eligible.
 *
 * @param ctx - Convex internal action context
 * @param args.daysToSync - Optional day count passed through when the gate opens
 * @returns Either skip metadata or aggregate counts from runReloadDockEventsWindow
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
