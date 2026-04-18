/**
 * Multi-day vessel timeline reseed for recovery windows.
 */

import type { ActionCtx } from "_generated/server";
import { getSailingDay } from "../../../shared/time";
import { reseedVesselTimelineForDate } from "./reseedVesselTimelineForDate";
import type { WindowSyncDayResult } from "./types";

/**
 * Reseed today and the following N-1 sailing days as one recovery window.
 *
 * @param ctx - Convex action context
 * @param daysToSyncOverride - Optional number of sailing days to reseed
 * @returns Aggregate counts plus per-day reseed summaries
 */
export const syncWindowedVesselTimeline = async (
  ctx: ActionCtx,
  daysToSyncOverride?: number
) => {
  // Get the start date and the number of days to sync
  const startDate = getSailingDay(new Date());
  const daysToSync = daysToSyncOverride ?? 2;
  const daysProcessed: WindowSyncDayResult[] = [];
  let totalScheduled = 0;
  let totalActual = 0;

  // Process each day in the window
  for (let i = 0; i < daysToSync; i++) {
    // Add the number of days to the start date to get the sailing day
    const sailingDay = addDays(startDate, i);

    // Re-seed the vessel timeline for the sailing day
    const result = await reseedVesselTimelineForDate(ctx, sailingDay);

    // Add the counts to the totals
    totalScheduled += result.ScheduledCount;
    totalActual += result.ActualCount;

    // Add the result to the days processed
    daysProcessed.push({
      sailingDay,
      scheduledCount: result.ScheduledCount,
      actualCount: result.ActualCount,
    });
  }

  // Return the totals and days processed
  return {
    totalScheduled,
    totalActual,
    daysProcessed,
  };
};

/**
 * Add whole sailing days to a YYYY-MM-DD string using a noon-UTC anchor to
 * avoid timezone rollovers.
 *
 * @param dateString - Base sailing day in YYYY-MM-DD format
 * @param days - Number of days to offset, positive or negative
 * @returns Shifted sailing day string in YYYY-MM-DD format
 */
const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
