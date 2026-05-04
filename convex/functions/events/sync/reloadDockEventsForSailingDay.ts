/**
 * Single-day dock-event reload helper.
 *
 * Action-side glue: fetch identities, schedule, and history, then hand the
 * Convex reload payload to the internal mutation. The mutation owns
 * schedule-to-transition merging and history hydration so this helper stays
 * responsible only for talking to external APIs.
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
 * Reloads scheduled and actual dock-event rows for one sailing day.
 *
 * Loads vessel and terminal identities for adapter resolution, fetches the
 * WSF schedule slice and per-vessel history rows, then hands a Convex-shaped
 * payload to replaceDockEventsForSailingDay. The mutation performs the
 * schedule and history merges and persists rows in one transaction.
 *
 * @param ctx - Convex action context for adapter calls and mutation scheduling
 * @param targetDate - Sailing day YYYY-MM-DD string used across fetch and persistence
 * @returns ScheduledCount and ActualCount from the replacement mutation result
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

  console.log(
    `${LOG_PREFIX} Found ${scheduleSegments.length} schedule segments for ${targetDate}`
  );

  const historyRecords = await fetchHistoryRecordsForDate(
    scheduleSegments,
    targetDate
  );

  const reloadDockData = buildConvexReloadDockDataFromFetchedSlices({
    sailingDay: targetDate,
    scheduleSegments,
    historyRecords,
  });

  const result = await ctx.runMutation(
    internal.functions.events.sync.mutations.replaceDockEventsForSailingDay,
    { ReloadDockData: reloadDockData }
  );

  console.log(
    `${LOG_PREFIX} reload completed for ${targetDate}: ${result.ScheduledCount} scheduled rows`
  );

  return result;
};

export { runReloadDockEventsForSailingDay };
