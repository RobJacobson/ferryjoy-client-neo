/**
 * Orchestrates reseed of scheduled and actual event rows for one sailing day.
 */

import type { MutationCtx } from "_generated/server";
import { buildReseedTimelineSlice } from "domain/timelineReseed";
import { replaceActualRowsForSailingDay } from "functions/events/eventsActual/mutations";
import { upsertScheduledRowsForSailingDay } from "functions/events/eventsScheduled/mutations";
import type { ConvexVesselTimelineEventRecord } from "../schemas";
import { loadTripIndexesForSailingDay } from "./loadTripIndexesForSailingDay";

type ReseedBoundaryEventsArgs = {
  SailingDay: string;
  Events: ConvexVesselTimelineEventRecord[];
};

/**
 * Reseeds scheduled and actual event-table rows for one sailing day.
 *
 * Loads trip indexes and live locations, builds `scheduledRows` / `actualRows`
 * in `buildReseedTimelineSlice`, then calls `upsertScheduledRowsForSailingDay`
 * and `replaceActualRowsForSailingDay` in order.
 *
 * @param ctx - Mutation context
 * @param args - Sailing day and normalized boundary events
 * @returns Counts for scheduled and actual rows in the replaced slice
 */
export const runReseedBoundaryEventsForSailingDay = async (
  ctx: MutationCtx,
  args: ReseedBoundaryEventsArgs
) => {
  const updatedAt = Date.now();

  // Load trip indexes for the sailing day
  const { tripBySegmentKey, activeTripsByVesselAbbrev, physicalOnlyTrips } =
    await loadTripIndexesForSailingDay(ctx, args.SailingDay);

  // Load vessel locations
  const vesselLocations = await ctx.db.query("vesselLocations").collect();

  // Build the reseed timeline slice
  const { scheduledRows, actualRows, scheduledCount, actualCount } =
    buildReseedTimelineSlice({
      sailingDay: args.SailingDay,
      events: args.Events,
      updatedAt,
      tripBySegmentKey,
      activeTripsByVesselAbbrev,
      physicalOnlyTrips,
      vesselLocations,
    });

  // Upsert scheduled rows for the sailing day
  await upsertScheduledRowsForSailingDay(ctx, args.SailingDay, scheduledRows);

  // Replace actual rows for the sailing day
  await replaceActualRowsForSailingDay(ctx, args.SailingDay, actualRows);

  // Return the counts for the rows represented by that replaced slice
  return {
    ScheduledCount: scheduledCount,
    ActualCount: actualCount,
  };
};
