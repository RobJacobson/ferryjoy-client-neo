import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import {
  performSimpleScheduledTripsSyncForDate,
  performWindowedScheduledTripsSync,
} from "./actions/";

/**
 * Simplified manual sync that deletes all data for today and downloads fresh data.
 * Much simpler and more reliable than the complex diffing logic.
 */
export const syncScheduledTripsSimpleManual = action({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    return await performSimpleScheduledTripsSyncForDate(
      ctx,
      today,
      "[SIMPLE MANUAL] "
    );
  },
});

/**
 * Simplified sync for a specific date that deletes all data and downloads fresh data.
 */
export const syncScheduledTripsSimpleForDate = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await performSimpleScheduledTripsSyncForDate(
      ctx,
      args.targetDate,
      "[SIMPLE] "
    );
  },
});

/**
 * Manual trigger for testing windowed scheduled trips sync.
 * Processes the full N-day window (default 7 days) for comprehensive testing.
 * Useful for validating the complete automated sync process.
 */
export const syncScheduledTripsWindowedManual = action({
  args: {},
  handler: async (ctx) =>
    performWindowedScheduledTripsSync(ctx, "[MANUAL WINDOWED] "),
});

/**
 * Internal action for automated windowed scheduled trips sync.
 * Called daily by cron job to maintain accurate schedule data for the rolling N-day window.
 * Runs at 4:00 AM Pacific time to sync between WSF trip date boundaries.
 */
export const syncScheduledTripsWindowed = internalAction({
  args: {},
  handler: async (ctx) => performWindowedScheduledTripsSync(ctx),
});
