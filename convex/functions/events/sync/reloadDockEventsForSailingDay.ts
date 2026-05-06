/**
 * Single-day dock-event reload action helper.
 *
 * This module owns action-side adapter work for one sailing day, then hands the
 * scheduled and actual payloads to table-specific internal mutations.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchAndTransformScheduledTrips } from "adapters";
import { loadTerminalIdentities } from "functions/terminals/actions";
import { loadVesselIdentities } from "functions/vessels/actions";
import { buildConvexReloadDockDataFromFetchedSlices } from "./buildConvexReloadDockDataFromFetchedSlices";
import { fetchHistoryRecordsForDate } from "./fetchHistoryRecordsForDate";
import type { EventReloadResult } from "./types";

const LOG_PREFIX = "[RELOAD DOCK EVENTS]";

/**
 * Reloads scheduled and actual dock events for one sailing day.
 *
 * @param ctx - Convex action context used for fetches and internal mutations
 * @param targetDate - Sailing day YYYY-MM-DD string
 * @returns Scheduled and actual row counts produced by split reload mutations
 */
const runReloadDockEventsForSailingDay = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<EventReloadResult> => {
  console.log(`${LOG_PREFIX} Starting reload for ${targetDate}`);

  const vessels = await loadVesselIdentities(ctx);
  const terminals = await loadTerminalIdentities(ctx);
  const { routeData } = await fetchAndTransformScheduledTrips(
    targetDate,
    vessels,
    terminals
  );
  const scheduleSegments = routeData.flatMap((data) => data.segments);
  const historyRecords = await fetchHistoryRecordsForDate(
    scheduleSegments,
    targetDate
  );
  const reloadDockData = buildConvexReloadDockDataFromFetchedSlices({
    sailingDay: targetDate,
    scheduleSegments,
    historyRecords,
  });

  const scheduled = await ctx.runMutation(
    internal.functions.events.sync.mutations
      .replaceScheduledDockEventsForSailingDay,
    {
      ReloadDockScheduleData: {
        SailingDay: reloadDockData.SailingDay,
        ScheduleSegments: reloadDockData.ScheduleSegments,
      },
    }
  );
  const actual = await ctx.runMutation(
    internal.functions.events.sync.mutations
      .reloadActualDockEventsForSailingDay,
    { ReloadDockData: reloadDockData }
  );

  return {
    ScheduledCount: scheduled.ScheduledCount,
    ActualCount: actual.ActualCount,
  };
};

export { runReloadDockEventsForSailingDay };
