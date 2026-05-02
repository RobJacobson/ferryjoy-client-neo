/**
 * Registers actions for syncing normalized VesselTimeline boundary events.
 */

import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import { getPacificTimeComponents, getSailingDay } from "../../shared/time";
import type { TimelineSyncResult, WindowSyncDayResult } from "./sync";
import {
  reseedVesselTimelineForDate,
  syncWindowedVesselTimeline,
} from "./sync";

/**
 * Manually reseeds vessel timeline boundary events for today’s sailing day.
 *
 * Resolves “today” with `getSailingDay` in Pacific service-day terms, then runs
 * `reseedVesselTimelineForDate` for that string.
 *
 * @param ctx - Convex public action context
 * @returns Scheduled and actual row counts written for today
 */
export const syncVesselTimelineManual = action({
  args: {},
  handler: async (ctx): Promise<TimelineSyncResult> => {
    const sailingDay = getSailingDay(new Date());
    return await reseedVesselTimelineForDate(ctx, sailingDay);
  },
});

/**
 * Manually reseeds vessel timeline boundary events for one sailing day string.
 *
 * Public operator entry; forwards `targetDate` to `reseedVesselTimelineForDate`
 * without additional scheduling guards.
 *
 * @param ctx - Convex public action context
 * @param args - Action arguments containing the target sailing day
 * @returns Scheduled and actual row counts written for the requested date
 */
export const syncVesselTimelineForDateManual = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args): Promise<TimelineSyncResult> =>
    await reseedVesselTimelineForDate(ctx, args.targetDate),
});

/**
 * Reseeds a sliding window of consecutive sailing days starting from today.
 *
 * Internal cron/backfill path; optional `daysToSync` overrides the default window
 * width inside `syncWindowedVesselTimeline`.
 *
 * @param ctx - Convex internal action context
 * @param args - Action arguments containing an optional day-count override
 * @returns Aggregate scheduled and actual row counts for the processed window
 */
export const syncVesselTimelineWindowed = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, args) =>
    await syncWindowedVesselTimeline(ctx, args.daysToSync),
});

/**
 * Runs the windowed reseed only near the Pacific 3am sailing-day boundary.
 *
 * Skips outside that hour to avoid duplicate heavy work; when hour is 3,
 * delegates to `syncWindowedVesselTimeline` and merges skip metadata otherwise.
 *
 * @param ctx - Convex internal action context
 * @param args - Action arguments containing an optional day-count override
 * @returns Skip metadata or aggregate counts for the processed window
 */
export const syncVesselTimelineAtSailingDayBoundary = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const pacificNow = getPacificTimeComponents(new Date());

    if (pacificNow.hour !== 3) {
      return {
        skipped: true,
        reason: "outside_pacific_3am_window",
        totalScheduled: 0,
        totalActual: 0,
        daysProcessed: [] as WindowSyncDayResult[],
      };
    }

    return {
      skipped: false,
      ...(await syncWindowedVesselTimeline(ctx, args.daysToSync)),
    };
  },
});
