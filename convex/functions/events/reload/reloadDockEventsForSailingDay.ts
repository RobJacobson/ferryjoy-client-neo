/**
 * Dock-event reload action helpers: one sailing day and a consecutive-day
 * window from the current sailing day for crons and recovery workflows.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchAndTransformScheduledTrips } from "adapters";
import { buildHydratedDockBoundaryEventsForReload } from "domain/events/reload";
import type { ReloadDockDayCountResult } from "domain/events/reload/reseedDockBoundarySchemas";
import { loadTerminalIdentities } from "functions/terminals/actions";
import { loadVesselIdentities } from "functions/vessels/actions";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { getSailingDay } from "shared/time";
import { fetchReloadWsfInputs } from "./reloadDockInputs";

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

const LOG_PREFIX = "[RELOAD DOCK EVENTS]";

/**
 * Reloads scheduled and actual dock events for one sailing day.
 *
 * @param ctx - Convex action context used for fetches and internal mutations
 * @param targetDate - Sailing day YYYY-MM-DD string
 * @returns Scheduled and actual row counts from the unified reseed mutation
 */
const runReloadDockEventsForSailingDay = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<ReloadDockDayCountResult> => {
  console.log(`${LOG_PREFIX} Starting reload for ${targetDate}`);

  const vessels = await loadVesselIdentities(ctx);
  const terminals = await loadTerminalIdentities(ctx);
  const { routeData } = await fetchAndTransformScheduledTrips(
    targetDate,
    vessels,
    terminals
  );
  const adapterScheduleSegments = routeData.flatMap((data) => data.segments);
  const { scheduledSegments: scheduleSegments, historyRecords } =
    await fetchReloadWsfInputs(adapterScheduleSegments, targetDate);
  const events = buildHydratedDockBoundaryEventsForReload({
    scheduleSegments,
    historyRecords,
    vessels: vessels.map(stripConvexMeta),
    terminals: terminals.map(stripConvexMeta),
  });

  return await ctx.runMutation(
    internal.functions.events.reload.mutations.reseedDockEventsForSailingDay,
    {
      SailingDay: targetDate,
      Events: events,
    }
  );
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

export type { WindowReloadDayResult, WindowReloadResult };
export { runReloadDockEventsForSailingDay, runReloadDockEventsWindow };
