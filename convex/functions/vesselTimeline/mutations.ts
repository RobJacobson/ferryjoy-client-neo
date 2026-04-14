/**
 * Internal mutations for the normalized VesselTimeline boundary-event tables.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { buildReseedTimelineSlice } from "domain/timelineReseed";
import {
  type buildScheduledBoundaryEvents,
  indexTripsBySegmentKey,
} from "domain/timelineRows";
import type { ConvexActualBoundaryEvent } from "functions/eventsActual/schemas";
import { actualBoundaryRowsEqual } from "shared/actualBoundaryRowsEqual";
import { vesselTimelineEventRecordSchema } from "./schemas";

/**
 * Reseeds the structural scheduled backbone and hydrated actual rows for one
 * sailing day.
 *
 * Schedule sync owns this mutation. It treats the supplied day slice as the
 * complete truth for scheduled rows; `eventsActual` uses supersession by
 * `EventKey` and retains physical-only rows not in the new slice.
 *
 * @param args.SailingDay - Service day being fully replaced
 * @param args.Events - Boundary events already normalized in memory
 * @returns Counts for the rows represented by that replaced slice
 */
export const reseedBoundaryEventsForSailingDay = internalMutation({
  args: {
    SailingDay: v.string(),
    Events: v.array(vesselTimelineEventRecordSchema),
  },
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const tripIndex = await loadTripIndexForSailingDay(ctx, args.SailingDay);
    const vesselLocations = await ctx.db.query("vesselLocations").collect();

    const { scheduledRows, actualRows, scheduledCount, actualCount } =
      buildReseedTimelineSlice({
        sailingDay: args.SailingDay,
        events: args.Events,
        updatedAt,
        tripBySegmentKey: tripIndex,
        vesselLocations,
      });

    await replaceScheduledRowsForSailingDay(
      ctx,
      args.SailingDay,
      scheduledRows
    );
    await replaceActualRowsForSailingDay(ctx, args.SailingDay, actualRows);

    return {
      ScheduledCount: scheduledCount,
      ActualCount: actualCount,
    };
  },
});

/**
 * Loads active and completed trips for a sailing day and indexes them by
 * segment key for `TripKey` resolution.
 *
 * @param ctx - Mutation context
 * @param sailingDay - Target sailing day
 * @returns Map from segment key to trip context
 */
const loadTripIndexForSailingDay = async (
  ctx: MutationCtx,
  sailingDay: string
) => {
  const activeTrips = (
    await ctx.db.query("activeVesselTrips").collect()
  ).filter((t) => t.SailingDay === sailingDay);
  const completedTrips = (
    await ctx.db.query("completedVesselTrips").collect()
  ).filter((t) => t.SailingDay === sailingDay);

  return indexTripsBySegmentKey([...activeTrips, ...completedTrips]);
};

const replaceScheduledRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ReturnType<typeof buildScheduledBoundaryEvents>
) => {
  const existingRows = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();
  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));
  const nextKeys = new Set(nextRows.map((row) => row.Key));

  for (const existing of existingRows) {
    if (!nextKeys.has(existing.Key)) {
      await ctx.db.delete(existing._id);
    }
  }

  for (const nextRow of nextRows) {
    const existing = existingByKey.get(nextRow.Key);

    if (!existing) {
      await ctx.db.insert("eventsScheduled", nextRow);
      continue;
    }

    if (scheduledRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

/**
 * Replaces `eventsActual` for one sailing day: supersede by `EventKey` from
 * `finalRows`, retain existing **physical-only** rows (`ScheduleKey` absent)
 * whose `EventKey` is absent from the new slice, delete stale schedule-aligned
 * rows and everything else on that day outside the survive set.
 *
 * @param ctx - Convex mutation context
 * @param SailingDay - Service day
 * @param finalRows - Candidate rows from schedule hydration + live patches
 */
const replaceActualRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  finalRows: ConvexActualBoundaryEvent[]
) => {
  const existingRows = await ctx.db
    .query("eventsActual")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();

  const nextByEventKey = new Map(finalRows.map((row) => [row.EventKey, row]));

  const surviveEventKeys = new Set(nextByEventKey.keys());

  for (const row of existingRows) {
    if (!nextByEventKey.has(row.EventKey) && row.ScheduleKey === undefined) {
      surviveEventKeys.add(row.EventKey);
    }
  }

  for (const existing of existingRows) {
    if (!surviveEventKeys.has(existing.EventKey)) {
      await ctx.db.delete(existing._id);
    }
  }

  for (const nextRow of nextByEventKey.values()) {
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", nextRow.EventKey))
      .unique();

    if (!existing) {
      await ctx.db.insert("eventsActual", nextRow);
      continue;
    }

    if (actualBoundaryRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

const scheduledRowsEqual = (
  left: Doc<"eventsScheduled">,
  right: ReturnType<typeof buildScheduledBoundaryEvents>[number]
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.NextTerminalAbbrev === right.NextTerminalAbbrev &&
  left.EventType === right.EventType &&
  left.EventScheduledTime === right.EventScheduledTime &&
  (left.IsLastArrivalOfSailingDay ?? false) ===
    (right.IsLastArrivalOfSailingDay ?? false);
