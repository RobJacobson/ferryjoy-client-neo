/**
 * Windowed dock-event reload runner for crons and recovery workflows.
 *
 * Walks a consecutive run of sailing days through the single-day runner so the
 * boundary cron and operator recovery passes share one transaction-per-day
 * shape while reporting aggregate counts to the caller.
 */

import type { ActionCtx } from "_generated/server";
import { getSailingDay } from "shared/time";
import { runReloadDockEventsForSailingDay } from "./reloadDockEventsForSailingDay";

type WindowReloadDayResult = {
  sailingDay: string;
  scheduledCount: number;
  actualCount: number;
};

type WindowReloadResult = {
  totalScheduled: number;
  totalActual: number;
  daysProcessed: WindowReloadDayResult[];
};

/**
 * Reloads a consecutive window of sailing days starting today.
 *
 * Walks the window day-by-day so each sailing day still gets its own
 * isolated reseed transaction and per-day counts roll up cleanly for
 * monitoring. The default window length matches the production cron, and
 * the override is wired through the boundary and window actions so
 * operators can scale recovery passes without touching the runner itself.
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

    totalScheduled += result.scheduledCount;
    totalActual += result.actualCount;
    daysProcessed.push({
      sailingDay,
      scheduledCount: result.scheduledCount,
      actualCount: result.actualCount,
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

export type { WindowReloadDayResult };
export { runReloadDockEventsWindow };
