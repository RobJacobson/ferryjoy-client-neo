import { internal } from "_generated/api";
import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import { getSailingDay } from "../../shared/time";
import {
  syncScheduledTripsForDate,
  syncScheduledTripsForDateRange,
} from "./sync";

/**
 * Simplified manual sync that deletes all data for the current sailing day and downloads fresh data.
 * Much simpler and more reliable than the complex diffing logic.
 *
 * @param ctx - Convex action context
 * @returns Sync result with deletion and insertion counts
 */
export const syncScheduledTripsManual = action({
  args: {},
  handler: async (ctx) => {
    // Important: WSF "sailing day" runs 3:00 AM → 2:59 AM Pacific.
    // Using UTC calendar day here will often select the wrong day in the evening.
    const sailingDay = getSailingDay(new Date());
    return await syncScheduledTripsForDate(ctx, sailingDay);
  },
});

/**
 * Simplified sync for a specific date that deletes all data and downloads fresh data.
 *
 * @param ctx - Convex action context
 * @param args.targetDate - Target sailing day in YYYY-MM-DD format
 * @returns Sync result with deletion and insertion counts
 */
export const syncScheduledTripsForDateManual = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await syncScheduledTripsForDate(ctx, args.targetDate);
  },
});

/**
 * Internal action for automated windowed scheduled trips sync.
 * Called daily by cron job to maintain accurate schedule data for the rolling N-day window.
 * Runs at 4:00 AM Pacific time to sync between WSF trip date boundaries.
 *
 * @param ctx - Convex internal action context
 * @param args.daysToSync - Number of days to sync (defaults to 2)
 * @returns Sync result with deletion and insertion counts for all processed days
 */
export const syncScheduledTripsWindowed = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Start from the current sailing day, not the UTC date.
    const startDate = getSailingDay(new Date());
    const daysToSync = args.daysToSync || 2;

    return await syncScheduledTripsForDateRange(ctx, startDate, daysToSync);
  },
});

/**
 * Internal action that purges ScheduledTrips that are out of date by more than 24 hours.
 * Intended to run once daily at 11:00 AM UTC.
 *
 * Definition: when run at time T, delete any scheduledTrips with DepartingTime < (T - 24h).
 * Example: 11:00 AM UTC Jan 20 purges trips before 11:00 AM UTC Jan 19.
 *
 * @param ctx - Convex internal action context
 * @param args.cutoffMs - Optional explicit cutoff for testing (epoch ms). If omitted, uses now - 24h.
 * @returns Summary of purge operation
 */
export const purgeScheduledTripsOutOfDate = internalAction({
  args: { cutoffMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const cutoffMs = args.cutoffMs ?? nowMs - 24 * 60 * 60 * 1000;

    let totalDeleted = 0;
    const batchSize = 500;

    // Delete in batches to keep each mutation small and predictable.
    while (true) {
      const result = await ctx.runMutation(
        internal.functions.scheduledTrips.mutations
          .deleteScheduledTripsBeforeBatch,
        {
          cutoffMs,
          limit: batchSize,
        }
      );

      totalDeleted += result.deleted;

      if (!result.hasMore) {
        break;
      }
    }

    return {
      cutoffMs,
      deleted: totalDeleted,
    };
  },
});
