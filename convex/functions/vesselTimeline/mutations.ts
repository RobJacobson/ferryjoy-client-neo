/**
 * Internal mutations for the normalized VesselTimeline boundary-event tables.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import {
  buildActualBoundaryPatchesForSailingDay,
  normalizeScheduledDockSeams,
  sortVesselTripEvents,
} from "domain/vesselTimeline/events";
import {
  buildActualBoundaryEvents,
  buildScheduledBoundaryEvents,
} from "domain/vesselTimeline/normalizedEvents";
import { actualBoundaryRowsEqual } from "shared/actualBoundaryRowsEqual";
import { mergeActualBoundaryPatchesIntoRows } from "./mergeActualBoundaryPatchesIntoRows";
import { vesselTimelineEventRecordSchema } from "./schemas";

/**
 * Replaces the structural scheduled backbone and hydrated actual rows for one
 * sailing day.
 *
 * Schedule sync owns this mutation. It treats the supplied day slice as the
 * complete truth and makes the normalized tables match it exactly.
 *
 * @param args.SailingDay - Service day being fully replaced
 * @param args.Events - Boundary events already normalized in memory
 * @returns Counts for the rows represented by that replaced slice
 */
export const replaceBoundaryEventsForSailingDay = internalMutation({
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
    const events = normalizeScheduledDockSeams(args.Events).sort(
      sortVesselTripEvents
    );

    const nextScheduledRows = buildScheduledBoundaryEvents(events, updatedAt);
    const baseActualRows = buildActualBoundaryEvents(events, updatedAt);
    const vesselLocations = await ctx.db.query("vesselLocations").collect();
    const liveLocationActualPatches = buildActualBoundaryPatchesForSailingDay({
      sailingDay: args.SailingDay,
      scheduledEvents: nextScheduledRows,
      actualEvents: baseActualRows,
      vesselLocations,
    });
    const finalActualRows = mergeActualBoundaryPatchesIntoRows(
      baseActualRows,
      liveLocationActualPatches,
      updatedAt
    );

    await replaceScheduledRowsForSailingDay(
      ctx,
      args.SailingDay,
      nextScheduledRows
    );
    await replaceActualRowsForSailingDay(ctx, args.SailingDay, finalActualRows);

    return {
      ScheduledCount: events.length,
      ActualCount: finalActualRows.length,
    };
  },
});

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

const replaceActualRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ReturnType<typeof buildActualBoundaryEvents>
) => {
  const existingRows = await ctx.db
    .query("eventsActual")
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
