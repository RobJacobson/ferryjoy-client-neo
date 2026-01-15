import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { ConvexError } from "convex/values";
import { formatPacificDate } from "../../../shared/keys";
import { syncScheduledTripsForDate } from "./performSync";
import type { DaySyncResult } from "./types";

/**
 * Configuration constants for the windowed scheduled trips sync.
 * Defines the operational parameters for the rolling data window.
 */
const SYNC_CONFIG = {
  /** Number of consecutive days to maintain accurate schedule data */
  WINDOW_DAYS: 7,
} as const;

/**
 * Checks if schedule data already exists for a specific sailing day.
 * Used to determine whether to download fresh data or update existing data.
 *
 * @param ctx - Convex action context for database queries
 * @param sailingDay - Target sailing day in YYYY-MM-DD format
 * @returns true if any trip data exists for the day, false otherwise
 */
const hasDataForDay = async (
  ctx: ActionCtx,
  sailingDay: string
): Promise<boolean> => {
  const trips = await ctx.runQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForSailingDay,
    { sailingDay }
  );
  return trips.length > 0;
};

/**
 * Performs a comprehensive windowed synchronization of scheduled trips data.
 * Maintains accurate schedule data for a rolling N-day window by intelligently
 * downloading fresh data for days without existing data and updating existing data.
 *
 * This is the primary automated sync function used by the daily cron job.
 * It ensures data freshness while minimizing unnecessary API calls and database operations.
 *
 * Window Strategy:
 * - Day 0 (today): Always sync (schedule may change until departure)
 * - Days 1-N: Sync if data exists, download if missing
 * - Failed days don't stop the entire sync process
 * - Uses safe sync: downloads data before deleting existing data
 *
 * @param ctx - Convex action context for database operations and mutations
 * @param logPrefix - Prefix for log messages to identify automated vs manual runs
 * @throws ConvexError if the sync process encounters critical failures
 */
export const performWindowedScheduledTripsSync = async (
  ctx: ActionCtx,
  logPrefix: string = "[WINDOWED] "
): Promise<void> => {
  const today = new Date();

  try {
    console.log(
      `${logPrefix}Starting windowed sync for ${SYNC_CONFIG.WINDOW_DAYS}-day rolling window`
    );

    const syncResults: DaySyncResult[] = [];

    // Process each day in the rolling window sequentially
    // Sequential processing ensures predictable resource usage and error handling
    for (let i = 0; i < SYNC_CONFIG.WINDOW_DAYS; i++) {
      // Calculate the target date for this window position
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const sailingDay = formatPacificDate(targetDate);

      try {
        // Check if we already have data for this day to determine sync strategy
        const hasData = await hasDataForDay(ctx, sailingDay);

        if (hasData) {
          // Safely refresh existing data - download first, then replace
          console.log(
            `${logPrefix}Data exists for ${sailingDay}, safely refreshing with fresh data`
          );
          await syncScheduledTripsForDate(ctx, sailingDay, logPrefix);
          syncResults.push({ sailingDay, action: "updated" });
        } else {
          // Safely download fresh data for days we haven't seen before
          console.log(
            `${logPrefix}No data for ${sailingDay}, safely downloading complete schedule`
          );
          await syncScheduledTripsForDate(ctx, sailingDay, logPrefix);
          syncResults.push({ sailingDay, action: "downloaded" });
        }
      } catch (error) {
        // Log the error but continue with other days
        // Individual day failures shouldn't stop the entire sync process
        console.error(`${logPrefix}Failed to sync ${sailingDay}:`, error);
        syncResults.push({
          sailingDay,
          action: "failed",
          error: String(error),
        });
      }
    }

    // Aggregate and report comprehensive results
    const downloaded = syncResults.filter(
      (r) => r.action === "downloaded"
    ).length;
    const updated = syncResults.filter((r) => r.action === "updated").length;
    const failed = syncResults.filter((r) => r.action === "failed").length;

    console.log(
      `${logPrefix}Windowed sync completed: ${downloaded} days downloaded, ` +
        `${updated} days updated, ${failed} days failed`
    );

    // Warn about failures but don't fail the entire operation
    if (failed > 0) {
      console.warn(
        `${logPrefix}Warning: ${failed} out of ${SYNC_CONFIG.WINDOW_DAYS} days failed to sync. ` +
          `Check logs for details.`
      );
    }
  } catch (error) {
    console.error(`${logPrefix}Critical error in windowed sync:`, error);
    throw new ConvexError({
      message: "Windowed scheduled trips sync failed catastrophically",
      code: "WINDOWED_SYNC_FAILED",
      severity: "error",
      details: {
        windowDays: SYNC_CONFIG.WINDOW_DAYS,
        error: String(error),
      },
    });
  }
};
