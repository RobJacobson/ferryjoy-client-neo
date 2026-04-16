/**
 * Scheduled-trips sync and purge: internal actions for crons, operators (CLI), and
 * backend-only manual runs. Public Convex clients cannot call these entrypoints.
 */

import { internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { v } from "convex/values";
import { getSailingDay } from "../../shared/time";
import { scheduledTripsConfig } from "./constants";
import {
  syncScheduledTripsForDate,
  syncScheduledTripsForDateRange,
} from "./sync";

/** Single-day sync summary returned by adapter + replace mutation. */
const scheduledTripsSyncDayResult = v.object({
  deleted: v.number(),
  inserted: v.number(),
  routesProcessed: v.number(),
  totalIndirect: v.number(),
});

/** One row in the windowed sync rollup. */
const scheduledTripsDayProcessed = v.object({
  sailingDay: v.string(),
  action: v.union(v.literal("synced"), v.literal("failed")),
  error: v.optional(v.string()),
});

const scheduledTripsWindowedSyncResult = v.object({
  totalDeleted: v.number(),
  totalInserted: v.number(),
  totalIndirect: v.number(),
  daysProcessed: v.array(scheduledTripsDayProcessed),
});

const purgeScheduledTripsResult = v.object({
  cutoffMs: v.number(),
  deleted: v.number(),
});

/**
 * Operator/manual sync for the current WSF sailing day (replaces that day in DB).
 * Run via `bunx convex run functions/scheduledTrips/actions:runManualScheduledTripsSync '{}'`.
 *
 * @param ctx - Convex action context
 * @returns Per-day sync counts for the sailing day
 */
export const runManualScheduledTripsSync = internalAction({
  args: {},
  returns: scheduledTripsSyncDayResult,
  handler: async (ctx) => {
    const sailingDay = getSailingDay(new Date());
    return await syncScheduledTripsForDate(ctx, sailingDay);
  },
});

/**
 * Operator/manual sync for a specific sailing day (YYYY-MM-DD).
 * Run via `bunx convex run functions/scheduledTrips/actions:runManualScheduledTripsSyncForDate '{"targetDate":"YYYY-MM-DD"}'`.
 *
 * @param ctx - Convex action context
 * @param args.targetDate - Target sailing day in YYYY-MM-DD format
 * @returns Per-day sync counts
 */
export const runManualScheduledTripsSyncForDate = internalAction({
  args: {
    targetDate: v.string(),
  },
  returns: scheduledTripsSyncDayResult,
  handler: async (ctx, args) => {
    return await syncScheduledTripsForDate(ctx, args.targetDate);
  },
});

/**
 * Windowed scheduled-trips sync for consecutive sailing days starting at today’s
 * sailing day. Crons pass `scheduledTripsConfig.dailySyncDays` (daily) or
 * `scheduledTripsConfig.intervalRefreshSyncDays` (15-minute refresh); see
 * `constants.ts`.
 *
 * @param ctx - Convex internal action context
 * @param args.daysToSync - Number of consecutive days to sync (defaults to
 *   `scheduledTripsConfig.windowedDefaultDays` if omitted)
 * @returns Rollup of deletes, inserts, and per-day status
 */
export const syncScheduledTripsWindowed = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  returns: scheduledTripsWindowedSyncResult,
  handler: async (ctx, args) => {
    const startDate = getSailingDay(new Date());
    const daysToSync =
      args.daysToSync ?? scheduledTripsConfig.windowedDefaultDays;

    return await syncScheduledTripsForDateRange(ctx, startDate, daysToSync);
  },
});

/**
 * Purges scheduledTrips with DepartingTime older than the cutoff (default: now − 24h).
 * Intended for the daily cron at 11:00 UTC.
 *
 * @param ctx - Convex internal action context
 * @param args.cutoffMs - Optional explicit cutoff for testing (epoch ms)
 * @returns Cutoff used and total rows deleted
 */
export const purgeScheduledTripsOutOfDate = internalAction({
  args: { cutoffMs: v.optional(v.number()) },
  returns: purgeScheduledTripsResult,
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const cutoffMs =
      args.cutoffMs ?? nowMs - scheduledTripsConfig.purgeLookbackMs;

    let totalDeleted = 0;

    while (true) {
      const result = await ctx.runMutation(
        internal.functions.scheduledTrips.mutations
          .deleteScheduledTripsBeforeBatch,
        {
          cutoffMs,
          limit: scheduledTripsConfig.purgeBatchSize,
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
