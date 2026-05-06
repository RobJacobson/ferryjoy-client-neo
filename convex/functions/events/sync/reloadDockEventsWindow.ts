/**
 * Multi-day dock-event reload action helper.
 *
 * Recovery and cron workflows use this helper to reload consecutive sailing
 * days from the current sailing day and aggregate operator-facing counts.
 */

import type { ActionCtx } from "_generated/server";
import { getSailingDay } from "shared/time";
import { runReloadDockEventsForSailingDay } from "./reloadDockEventsForSailingDay";
import type { WindowReloadDayResult, WindowReloadResult } from "./types";

/**
 * Reloads a consecutive window of sailing days starting today.
 *
 * @param ctx - Convex action context passed to each single-day reload
 * @param daysToSyncOverride - Optional number of sailing days to reload
 * @returns Aggregated scheduled and actual counts with per-day entries
 */
const runReloadDockEventsWindow = async (
  ctx: ActionCtx,
  daysToSyncOverride?: number
): Promise<WindowReloadResult> => {
  const startDate = getSailingDay(new Date());
  const daysToSync = daysToSyncOverride ?? 2;
  const daysProcessed: WindowReloadDayResult[] = [];
  let totalScheduled = 0;
  let totalActual = 0;

  for (let index = 0; index < daysToSync; index++) {
    const sailingDay = addDaysToSailingDay(startDate, index);
    const result = await runReloadDockEventsForSailingDay(ctx, sailingDay);

    totalScheduled += result.ScheduledCount;
    totalActual += result.ActualCount;
    daysProcessed.push({
      sailingDay,
      scheduledCount: result.ScheduledCount,
      actualCount: result.ActualCount,
    });
  }

  return {
    totalScheduled,
    totalActual,
    daysProcessed,
  };
};

/**
 * Adds whole calendar days to a YYYY-MM-DD sailing-day string.
 *
 * @param dateString - Base sailing day
 * @param days - Whole-day offset
 * @returns Sailing day string for the offset date
 */
const addDaysToSailingDay = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};

export { runReloadDockEventsWindow };
