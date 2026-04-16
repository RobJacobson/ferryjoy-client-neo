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
 * Manually reseed the current sailing day's vessel timeline rows.
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
 * Manually reseed vessel timeline rows for a specific sailing day.
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
 * Reseed a sliding window of sailing days for timeline recovery or backfill.
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
 * Run the windowed reseed only during the Pacific 3am sailing-day boundary.
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
