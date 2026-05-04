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
 * Loads trip indexes and live locations, builds `scheduledRows` / `actualRows`
 * in `buildDockEventRowsForSailingDayReload`, then writes the two event tables.
 *
 * @param ctx - Mutation context
 * @param args - Sailing day and normalized boundary events
 * @returns Counts for scheduled and actual rows in the replaced slice
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
