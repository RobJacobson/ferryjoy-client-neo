/**
 * Internal mutations for the normalized `eventsActual` table.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { actualDockRowsEqual } from "functions/events/shared/actualDockRowsEqual";
import { type ConvexActualDockEvent, eventsActualSchema } from "./schemas";

/**
 * Applies normalized actual-time dock rows emitted by `vesselTrips`.
 *
 * These are already persistence-ready rows, so the mutation only dedupes,
 * compares, and upserts.
 *
 * @param ctx - Convex internal mutation context
 * @param args - Mutation arguments containing actual dock rows
 * @returns `null`
 */
export const projectActualDockWrites = internalMutation({
  args: {
    Writes: v.array(eventsActualSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertActualDockRows(ctx, args.Writes);
    return null;
  },
});

/**
 * Upserts rows by physical `EventKey`.
 *
 * @param ctx - Convex mutation context
 * @param rows - Normalized actual dock rows
 * @returns `undefined` after the upsert pass completes
 */
const upsertActualDockRows = async (
  ctx: MutationCtx,
  rows: ConvexActualDockEvent[]
) => {
  // Create a map of deduplicated rows by event key
  const dedupedByEventKey = new Map<string, ConvexActualDockEvent>();

  // Deduplicate rows by event key
  for (const row of rows) {
    dedupedByEventKey.set(row.EventKey, row);
  }

  // Insert or update rows that are present in the new slice
  for (const row of dedupedByEventKey.values()) {
    // Load the existing row for the event key
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", row.EventKey))
      .unique();

    // If the row is not present in the existing slice, insert it
    if (!existing) {
      await ctx.db.insert("eventsActual", row);
      continue;
    }

    // If the row is present in the existing slice and is equal to the new row, skip it
    if (actualDockRowsEqual(existing, row)) {
      continue;
    }

    // If the row is present in the existing slice and is not equal to the new row, update it
    await ctx.db.replace(existing._id, row);
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
export const replaceActualRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  finalRows: ConvexActualDockEvent[]
): Promise<void> => {
  // Load all existing rows for the sailing day
  const existingRows = await ctx.db
    .query("eventsActual")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();

  // Create a map of new rows by event key for quick lookup
  const nextByEventKey = new Map(finalRows.map((row) => [row.EventKey, row]));

  // Create a set of event keys from the new rows for quick lookup
  const surviveEventKeys = new Set(nextByEventKey.keys());

  // Add event keys of existing rows that are not present in the new slice and are physical-only
  for (const row of existingRows) {
    if (!nextByEventKey.has(row.EventKey) && row.ScheduleKey === undefined) {
      surviveEventKeys.add(row.EventKey);
    }
  }

  // Delete rows that are no longer present in the new slice
  await Promise.all(
    existingRows
      .filter((existing) => !surviveEventKeys.has(existing.EventKey))
      .map((existing) => ctx.db.delete(existing._id))
  );

  // Insert or update rows that are present in the new slice
  for (const nextRow of nextByEventKey.values()) {
    // Load the existing row for the event key
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", nextRow.EventKey))
      .unique();

    // If the row is not present in the existing slice, insert it
    if (!existing) {
      await ctx.db.insert("eventsActual", nextRow);
      continue;
    }

    // If the row is present in the existing slice and is equal to the new row, skip it
    if (actualDockRowsEqual(existing, nextRow)) {
      continue;
    }

    // If the row is present in the existing slice and is not equal to the new row, update it
    await ctx.db.replace(existing._id, nextRow);
  }
};
