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
 * Uses current sailing day from getSailingDay as day zero, iterates forward by whole
 * calendar days via addDays, and aggregates counts so operators can verify multi-day recovery jobs.
 * Defaults to two days when override omitted to match legacy cron expectations unless callers pass a wider span.
 *
 * @param ctx - Convex action context passed to each single-day reload
 * @param daysToSyncOverride - Optional inclusive day count beginning at startDate
 * @returns Totals plus per-day sailingDay, scheduledCount, and actualCount entries
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
 * Shifts a sailing-day calendar string forward by whole UTC-calendar days.
 *
 * Parses components as UTC noon to avoid local-DST edge cases when adding days, then
 * formats back through getSailingDay for consistent YYYY-MM-DD output with the rest of the app.
 *
 * @param dateString - Base sailing day in YYYY-MM-DD format
 * @param days - Non-negative offset count to advance the calendar
 * @returns Sailing day string for the offset date
 */
const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};

export { runReloadDockEventsWindow };
