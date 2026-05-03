/**
 * Writes to `eventsScheduled`: full-day reconciliation when an adapter delivers
 * a complete planned dock sequence for one sailing day.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import type { ConvexScheduledDockEvent } from "./schemas";

/**
 * Replaces stored scheduled rows for `SailingDay` with `nextRows`.
 *
 * Deletes keys the adapter no longer reports, inserts new keys, and replaces
 * only when visible fields differ so unchanged schedule rows are not rewritten.
 *
 * @param ctx - Convex mutation context
 * @param SailingDay - Service day being fully replaced
 * @param nextRows - Complete replacement slice for that day from the adapter
 */
export const upsertScheduledRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ConvexScheduledDockEvent[]
): Promise<void> => {
  // Reads every scheduled row for this sailing day before computing deletes and upserts.
  const existingRows = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();

  // Indexes existing rows by Key for replace lookups; nextKeys lists keys in the adapter slice.
  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));

  // Removes stored boundaries the adapter no longer reports for this day.
  const nextKeys = new Set(nextRows.map((row) => row.Key));
  await Promise.all(
    existingRows
      .filter((existing) => !nextKeys.has(existing.Key))
      .map((existing) => ctx.db.delete(existing._id))
  );

  // Inserts new keys or replaces when visible schedule fields changed.
  for (const nextRow of nextRows) {
    const existing = existingByKey.get(nextRow.Key);

    if (!existing) {
      await ctx.db.insert("eventsScheduled", nextRow);
      continue;
    }

    // Skip replace when fields match so `_creationTime` and bandwidth stay stable.
    if (scheduledRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

/**
 * Returns whether two scheduled rows match for persistence purposes.
 *
 * Ignores Convex metadata and compares visible schedule fields only.
 *
 * @param left - Stored `eventsScheduled` document
 * @param right - Candidate row from the adapter
 * @returns `true` when replace would be a no-op
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
