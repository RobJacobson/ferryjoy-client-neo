/**
 * Single-day dock-event reload helper.
 *
 * This action-side helper fetches schedules and history, builds neutral
 * boundary records, and delegates persistence to an internal mutation.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchAndTransformScheduledTrips } from "adapters";
import {
  buildScheduledDockEventRecords,
  hydrateActualDockEvents,
} from "domain/events";
import { loadTerminalIdentities } from "functions/terminals/actions";
import { loadVesselIdentities } from "functions/vessels/actions";
import { fetchHistoryRecordsForDate } from "./fetchHistoryRecordsForDate";
import type { EventReloadResult } from "./types";

const LOG_PREFIX = "[RELOAD DOCK EVENTS]";

/**
 * Reloads scheduled and actual dock-event rows for one sailing day via actions.
 *
 * Fetches transformed schedules, builds seeded boundary records, hydrates them with
 * external vessel history, then invokes replaceDockEventsForSailingDayRows so internal
 * mutations persist both tables atomically per day.
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

  const seededEvents = buildScheduledDockEventRecords(
    scheduleSegments,
    vessels,
    terminals
  );
  const historyRecords = await fetchHistoryRecordsForDate(
    scheduleSegments,
    targetDate
  );
  const hydratedEvents = hydrateActualDockEvents({
    seededEvents,
    existingEvents: [],
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });

  const result = await ctx.runMutation(
    internal.functions.events.sync.mutations.replaceDockEventsForSailingDay,
    {
      SailingDay: targetDate,
      Events: hydratedEvents,
    }
  );

  console.log(
    `${LOG_PREFIX} reload completed for ${targetDate}: ${result.ScheduledCount} scheduled rows`
  );

  return result;
};

export { runReloadDockEventsForSailingDay };
