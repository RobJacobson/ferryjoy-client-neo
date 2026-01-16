import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import { getSailingDay } from "../../shared/time";
import {
  syncScheduledTripsForDate,
  syncScheduledTripsForDateRange,
} from "./sync/sync";

/**
 * Simplified manual sync that deletes all data for the *current sailing day*
 * and downloads fresh data.
 * Much simpler and more reliable than the complex diffing logic.
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
    // Start from the current sailing day, not the UTC date.
    const startDate = getSailingDay(new Date());
    const daysToSync = args.daysToSync || 7;

    return await syncScheduledTripsForDateRange(ctx, startDate, daysToSync);
  },
});
