/**
 * Internal mutation for static dock-event reload persistence.
 *
 * External WSF inputs cross from the action into this mutation; Convex table
 * reads, domain planning, and table writes stay together for one sailing day.
 */

import { internalMutation, type MutationCtx } from "_generated/server";
import { computeDockEventsReload } from "domain/events/reload";
import {
  type ReloadDockDayCountResult,
  type ReseedDockStatusEventsFromExternalInputArgs,
  reseedDockEventsDayCountReturnSchema,
  reseedDockStatusEventsFromExternalInputArgsSchema,
} from "domain/events/reload/schemas";
import { replaceActualRowsForSailingDay } from "functions/events/eventsActual/mutations";
import { upsertScheduledRowsForSailingDay } from "functions/events/eventsScheduled/mutations";
import { stripConvexMeta } from "shared/stripConvexMeta";

const loadReloadDbInput = async (ctx: MutationCtx, sailingDay: string) => {
  const activeTrips = await ctx.db
    .query("activeVesselTrips")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", sailingDay))
    .collect();
  const completedTrips = await ctx.db
    .query("completedVesselTrips")
    .withIndex("by_sailing_day_and_departing_terminal", (q) =>
      q.eq("SailingDay", sailingDay)
    )
    .collect();

  return {
    activeTrips,
    completedTrips,
    vesselLocations: (await ctx.db.query("vesselLocations").collect()).map(
      stripConvexMeta
    ),
  };
};

/**
 * Replaces scheduled and actual dock-event rows for one sailing day.
 *
 * @param ctx - Convex mutation context
 * @param args.SailingDay - Target sailing day
 * @param args - External reload input from the action
 * @returns Scheduled and actual row counts for the replaced sailing day
 */
const reseedDockStatusEventsForSailingDayRows = async (
  ctx: MutationCtx,
  args: ReseedDockStatusEventsFromExternalInputArgs
): Promise<ReloadDockDayCountResult> => {
  const updatedAt = Date.now();
  const sailingDay = args.SailingDay;
  const { activeTrips, completedTrips, vesselLocations } =
    await loadReloadDbInput(ctx, sailingDay);
  const reload = computeDockEventsReload({
    sailingDay,
    scheduleSegments: args.ScheduleSegments,
    historyRecords: args.HistoryRecords,
    vessels: args.Vessels,
    terminals: args.Terminals,
    updatedAt,
    activeTrips,
    completedTrips,
    vesselLocations,
  });

  await upsertScheduledRowsForSailingDay(
    ctx,
    reload.sailingDay,
    reload.scheduledRows
  );
  await replaceActualRowsForSailingDay(
    ctx,
    reload.sailingDay,
    reload.actualRows,
    {
      preserveAbsentTripKeys: reload.physicalOnlyTripKeysToPreserve,
    }
  );

  return {
    scheduledCount: reload.scheduledRows.length,
    actualCount: reload.actualRows.length,
  };
};

const reseedDockStatusEventsForSailingDay = internalMutation({
  args: reseedDockStatusEventsFromExternalInputArgsSchema,
  returns: reseedDockEventsDayCountReturnSchema,
  handler: async (ctx, args) =>
    await reseedDockStatusEventsForSailingDayRows(ctx, args),
});

export type {
  DockStatusEventRecord,
  ReloadDockDayCountResult,
  ReseedDockStatusEventsFromExternalInputArgs,
} from "domain/events/reload/schemas";
export { reseedDockStatusEventsForSailingDay };
