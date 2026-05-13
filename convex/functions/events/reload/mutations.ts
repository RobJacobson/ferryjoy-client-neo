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

/**
 * Loads Convex-side reload inputs for one sailing day.
 *
 * @param ctx - Convex mutation context exposing database reads
 * @param sailingDay - Target sailing day
 * @returns Active trips, completed trips, and stripped vessel locations
 */
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
 * Combines Convex-side trip and location reads with the action-supplied WSF
 * inputs so the entire reload plan is computed once, then persists the
 * scheduled and actual sets through table-owned mutations. Physical-only
 * TripKeys are forwarded to the actual replacement so live trips that lack
 * schedule alignment are not deleted alongside the scheduled-day cleanup.
 *
 * @param ctx - Convex mutation context
 * @param args - External reload input from the action
 * @returns Scheduled and actual row counts for the replaced sailing day
 */
const reseedDockStatusEventsForSailingDayRows = async (
  ctx: MutationCtx,
  args: ReseedDockStatusEventsFromExternalInputArgs
): Promise<ReloadDockDayCountResult> => {
  const updatedAt = Date.now();
  const sailingDay = args.SailingDay;

  // Read Convex-side trip and location context the domain reload needs.
  const { activeTrips, completedTrips, vesselLocations } =
    await loadReloadDbInput(ctx, sailingDay);

  // Compute the full reload payload once so the table writes stay deterministic.
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

  // Replace scheduled rows for the day; the table owns its own diff strategy.
  await upsertScheduledRowsForSailingDay(
    ctx,
    reload.sailingDay,
    reload.scheduledRows
  );

  // Replace actuals while preserving rows for physical-only trips.
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

/**
 * Internal mutation that reseeds one sailing day of dock-event rows.
 *
 * Crosses the action-to-mutation boundary for static dock reloads. The
 * action gathers WSF inputs and identity tables; this mutation reads
 * Convex-side trip and location context, runs the domain reload, and
 * persists scheduled and actual rows in one transaction so the sailing day
 * is replaced atomically from the client's point of view.
 *
 * @param ctx - Convex internal mutation context
 * @param args - External reload inputs forwarded from the action
 * @returns Scheduled and actual row counts for the replaced sailing day
 */
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
