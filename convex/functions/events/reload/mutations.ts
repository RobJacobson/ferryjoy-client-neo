/**
 * Internal mutation for static dock-event reload persistence.
 *
 * One entrypoint matches the old vessel timeline reseed: hydrated dock status
 * events cross the action boundary, then scheduled and actual tables are
 * replaced in one mutation with a single trip-index pass (no separate identity
 * queries).
 */

import { internalMutation, type MutationCtx } from "_generated/server";
import {
  buildReloadDockSliceFromHydratedEvents,
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
} from "domain/events/reload";
import {
  type ReloadDockDayCountResult,
  type ReseedDockStatusEventsForSailingDayArgs,
  reseedDockEventsDayCountReturnSchema,
  reseedDockStatusEventsForSailingDayArgsSchema,
} from "domain/events/reload/dockStatusEventSchemas";
import { replaceActualRowsForSailingDay } from "functions/events/eventsActual/mutations";
import { upsertScheduledRowsForSailingDay } from "functions/events/eventsScheduled/mutations";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * Loads trip indexes for dock status event reseed slice assembly (same logic as
 * old runReseedBoundaryEventsForSailingDay trip reads).
 *
 * @param ctx - Convex mutation context for vessel-trip table reads
 * @param sailingDay - Target sailing day string
 * @returns Segment key map, active-trip map, and physical-only trips
 */
const loadTripIndexesForReseedDockStatusEvents = async (
  ctx: MutationCtx,
  sailingDay: string
) => {
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

  const mergedTrips = [...activeTrips, ...completedTrips];

  return {
    tripBySegmentKey: indexTripsBySegmentKey(mergedTrips),
    activeTripsByVesselAbbrev: indexActiveTripsByVesselAbbrev(activeTrips),
    physicalOnlyTrips: mergedTrips.filter(
      (trip) => trip.ScheduleKey === undefined
    ),
  };
};

/**
 * Replaces scheduled and actual dock-event rows for one sailing day.
 *
 * @param ctx - Convex mutation context
 * @param args.SailingDay - Target sailing day
 * @param args.Events - Hydrated dock status events from the reload action
 * @returns Scheduled and actual row counts for the replaced slice
 */
const reseedDockStatusEventsForSailingDayRows = async (
  ctx: MutationCtx,
  args: ReseedDockStatusEventsForSailingDayArgs
): Promise<ReloadDockDayCountResult> => {
  const updatedAt = Date.now();
  const sailingDay = args.SailingDay;
  const { tripBySegmentKey, activeTripsByVesselAbbrev, physicalOnlyTrips } =
    await loadTripIndexesForReseedDockStatusEvents(ctx, sailingDay);
  const vesselLocations = (await ctx.db.query("vesselLocations").collect()).map(
    stripConvexMeta
  );
  const { scheduledRows, scheduledCount, actualRows, actualCount } =
    buildReloadDockSliceFromHydratedEvents({
      sailingDay,
      events: args.Events,
      updatedAt,
      tripBySegmentKey,
      activeTripsByVesselAbbrev,
      physicalOnlyTrips,
      vesselLocations,
    });

  await upsertScheduledRowsForSailingDay(ctx, sailingDay, scheduledRows);
  await replaceActualRowsForSailingDay(ctx, sailingDay, actualRows, {
    preserveAbsentTripKeys: new Set(
      physicalOnlyTrips
        .map((trip) => trip.TripKey)
        .filter((tripKey): tripKey is string => tripKey !== undefined)
    ),
  });

  return {
    scheduledCount,
    actualCount,
  };
};

const reseedDockStatusEventsForSailingDay = internalMutation({
  args: reseedDockStatusEventsForSailingDayArgsSchema,
  returns: reseedDockEventsDayCountReturnSchema,
  handler: async (ctx, args) =>
    await reseedDockStatusEventsForSailingDayRows(ctx, args),
});

export type {
  DockStatusEventRecord,
  ReloadDockDayCountResult,
  ReseedDockStatusEventsForSailingDayArgs,
} from "domain/events/reload/dockStatusEventSchemas";
export { reseedDockStatusEventsForSailingDay };
