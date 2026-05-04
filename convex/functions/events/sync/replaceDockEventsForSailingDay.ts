/**
 * Prepares and persists dock-event rows for one sailing-day replacement.
 *
 * This module is mutation-only glue: it loads trip/location context, calls
 * domain row builders, and writes the scheduled and actual event tables.
 */

import type { MutationCtx } from "_generated/server";
import { buildDockEventRowsForSailingDayReload } from "domain/events";
import { replaceActualRowsForSailingDay } from "functions/events/eventsActual/mutations";
import { upsertScheduledRowsForSailingDay } from "functions/events/eventsScheduled/mutations";
import { loadTripIndexesForSailingDay } from "./loadTripIndexesForSailingDay";
import type { ConvexDockBoundaryEventRecord } from "./schemas";

type ReplaceDockEventsForSailingDayRowsArgs = {
  SailingDay: string;
  Events: ConvexDockBoundaryEventRecord[];
};

/**
 * Replaces scheduled and actual event-table rows for one sailing day.
 *
 * Combines domain reload output with trip indexes and every vesselLocations row so
 * live reconciliation matches sparse orchestrator behavior. Scheduled rows upsert in
 * bulk for the day while actual rows flow through replaceActualRowsForSailingDay for
 * grandfathered ping handling.
 *
 * @param ctx - Convex mutation context with database access
 * @param args.SailingDay - Calendar sailing day being rebuilt
 * @param args.Events - Hydrated DockBoundaryEventRecord inputs from adapters and history
 * @returns ScheduledCount and ActualCount reflecting rows produced for operators
 */
const replaceDockEventsForSailingDayRows = async (
  ctx: MutationCtx,
  args: ReplaceDockEventsForSailingDayRowsArgs
) => {
  const updatedAt = Date.now();

  const { tripBySegmentKey, activeTripsByVesselAbbrev, physicalOnlyTrips } =
    await loadTripIndexesForSailingDay(ctx, args.SailingDay);

  const vesselLocations = await ctx.db.query("vesselLocations").collect();

  const { scheduledRows, actualRows, scheduledCount, actualCount } =
    buildDockEventRowsForSailingDayReload({
      sailingDay: args.SailingDay,
      events: args.Events,
      updatedAt,
      tripBySegmentKey,
      activeTripsByVesselAbbrev,
      physicalOnlyTrips,
      vesselLocations,
    });

  await upsertScheduledRowsForSailingDay(ctx, args.SailingDay, scheduledRows);

  await replaceActualRowsForSailingDay(ctx, args.SailingDay, actualRows);

  return {
    ScheduledCount: scheduledCount,
    ActualCount: actualCount,
  };
};

export { replaceDockEventsForSailingDayRows };
