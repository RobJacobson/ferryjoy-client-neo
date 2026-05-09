/**
 * Internal mutation for static dock-event reload persistence.
 *
 * One entrypoint matches the old vessel timeline reseed: hydrated boundary
 * events cross the action boundary, then scheduled and actual tables are
 * replaced in one mutation with a single trip-index pass (no separate identity
 * queries).
 */

import { internalMutation, type MutationCtx } from "_generated/server";
import { v } from "convex/values";
import {
  buildReloadDockSliceFromHydratedEvents,
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
} from "domain/events/reload";
import { replaceActualRowsForSailingDay } from "functions/events/eventsActual/mutations";
import { upsertScheduledRowsForSailingDay } from "functions/events/eventsScheduled/mutations";
import {
  type ReseedDockEventsForSailingDayArgs,
  reseedDockEventsForSailingDayArgsSchema,
} from "functions/events/eventsScheduled/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * Loads trip indexes for reload slice assembly (same logic as old
 * runReseedBoundaryEventsForSailingDay trip reads).
 *
 * @param ctx - Convex mutation context for vessel-trip table reads
 * @param sailingDay - Target sailing day string
 * @returns Segment key map, active-trip map, and physical-only trips
 */
const loadTripIndexesForReloadDockMutation = async (
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
 * @param args.Events - Hydrated boundary events from the reload action
 * @returns Scheduled and actual row counts for the replaced slice
 */
const reseedDockEventsForSailingDayRows = async (
  ctx: Parameters<typeof upsertScheduledRowsForSailingDay>[0],
  args: ReseedDockEventsForSailingDayArgs
): Promise<{ ScheduledCount: number; ActualCount: number }> => {
  const updatedAt = Date.now();
  const sailingDay = args.SailingDay;
  const { tripBySegmentKey, activeTripsByVesselAbbrev, physicalOnlyTrips } =
    await loadTripIndexesForReloadDockMutation(ctx, sailingDay);
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
    ScheduledCount: scheduledCount,
    ActualCount: actualCount,
  };
};

const reseedDockEventsForSailingDay = internalMutation({
  args: reseedDockEventsForSailingDayArgsSchema,
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
  handler: async (ctx, args) =>
    await reseedDockEventsForSailingDayRows(ctx, args),
});

export { reseedDockEventsForSailingDay, reseedDockEventsForSailingDayRows };
