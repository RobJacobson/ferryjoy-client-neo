/**
 * Single-day dock-event reload action helper.
 *
 * Owns adapter fetches and delegates WSF epoch-ms mapping to reloadDockInputs,
 * then runs domain hydrate and the unified reseed internal mutation.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchAndTransformScheduledTrips } from "adapters";
import { buildHydratedDockBoundaryEventsForReload } from "domain/events/reload";
import { loadTerminalIdentities } from "functions/terminals/actions";
import { loadVesselIdentities } from "functions/vessels/actions";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { fetchReloadWsfInputs } from "./reloadDockInputs";

type EventReloadResult = {
  ScheduledCount: number;
  ActualCount: number;
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
): Promise<EventReloadResult> => {
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

  const result = await ctx.runMutation(
    internal.functions.events.reload.mutations.reseedDockEventsForSailingDay,
    {
      SailingDay: targetDate,
      Events: events,
    }
  );

  return {
    ScheduledCount: result.ScheduledCount,
    ActualCount: result.ActualCount,
  };
};

export type { EventReloadResult };
export { runReloadDockEventsForSailingDay };
