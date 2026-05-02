/**
 * Internal mutations for scheduled-event table reconciliation.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import type { ConvexScheduledDockEvent } from "./schemas";

/**
 * Reconciles scheduled backbone rows for one sailing day from a full slice.
 *
 * Deletes keys absent from `nextRows`, inserts missing rows, and replaces only
 * when `scheduledRowsEqual` fails so unchanged schedule data does not rewrite.
 *
 * @param ctx - Convex mutation context
 * @param SailingDay - Service day being fully replaced
 * @param nextRows - Replacement scheduled boundary rows for the sailing day
 * @returns Resolves when deletes and upserts finish (no value)
 */
export const upsertScheduledRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ConvexScheduledDockEvent[]
): Promise<void> => {
  // Full-day replace needs the prior slice so we can delete keys absent from `nextRows`.
  const existingRows = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();

  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));

  const nextKeys = new Set(nextRows.map((row) => row.Key));

  // Remove schedule rows the adapter no longer reports for this day.
  await Promise.all(
    existingRows
      .filter((existing) => !nextKeys.has(existing.Key))
      .map((existing) => ctx.db.delete(existing._id))
  );

  // Insert or update rows that are present in the new slice
  for (const nextRow of nextRows) {
    const existing = existingByKey.get(nextRow.Key);

    // If the row is not present in the existing slice, insert it
    if (!existing) {
      await ctx.db.insert("eventsScheduled", nextRow);
      continue;
    }

    // Avoid churning `_creationTime` and write bandwidth when the slice matches.
    if (scheduledRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

/**
 * Returns whether two scheduled backbone rows match for persistence purposes.
 *
 * Compares user-visible fields only so `_id` / `_creationTime` differences do
 * not force redundant `replace` calls during day reconciliation.
 *
 * @param left - Currently stored scheduled boundary row
 * @param right - Candidate scheduled boundary row
 * @returns `true` when no replacement write is needed
 */
const scheduledRowsEqual = (
  left: Doc<"eventsScheduled">,
  right: ConvexScheduledDockEvent
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
