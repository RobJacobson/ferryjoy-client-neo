/**
 * Multi-day dock-event reload helper for recovery windows.
 *
 * The helper is action-side orchestration: it chooses sailing days, calls the
 * single-day reload helper, and aggregates row counts for operator feedback.
 */

import type { ActionCtx } from "_generated/server";
import { getSailingDay } from "../../../shared/time";
import { runReloadDockEventsForSailingDay } from "./reloadDockEventsForSailingDay";
import type { WindowReloadDayResult } from "./types";

/**
 * Reloads a consecutive window of sailing days starting from today.
 *
 * @param ctx - Convex action context
 * @param daysToSyncOverride - Optional number of sailing days to reload
 * @returns Aggregate counts plus per-day reload summaries
 */
const runReloadDockEventsWindow = async (
  ctx: ActionCtx,
  daysToSyncOverride?: number
) => {
  const startDate = getSailingDay(new Date());
  const daysToSync = daysToSyncOverride ?? 2;
  const daysProcessed: WindowReloadDayResult[] = [];
  let totalScheduled = 0;
  let totalActual = 0;

  for (let i = 0; i < daysToSync; i++) {
    const sailingDay = addDays(startDate, i);
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
 * Adds whole sailing days to a `YYYY-MM-DD` string.
 *
 * @param dateString - Base sailing day in `YYYY-MM-DD` format
 * @param days - Number of days to offset
 * @returns Shifted sailing day string in `YYYY-MM-DD` format
 */
const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};

export { runReloadDockEventsWindow };
