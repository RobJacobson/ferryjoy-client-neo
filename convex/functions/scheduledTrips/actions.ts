import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import { formatPacificDate } from "../../shared/keys";
import {
  syncScheduledTripsForDate,
  syncScheduledTripsForDateRange,
} from "./sync/sync";

/**
 * Simplified manual sync that deletes all data for today and downloads fresh data.
 * Much simpler and more reliable than the complex diffing logic.
 */
export const syncScheduledTripsManual = action({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    return await syncScheduledTripsForDate(ctx, today);
  },
});

/**
 * Simplified sync for a specific date that deletes all data and downloads fresh data.
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
 */
export const syncScheduledTripsWindowed = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const startDate = formatPacificDate(new Date());
    const daysToSync = args.daysToSync || 7;

    return await syncScheduledTripsForDateRange(ctx, startDate, daysToSync);
  },
});
