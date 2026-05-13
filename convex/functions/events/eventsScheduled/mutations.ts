/**
 * Internal mutation helpers for eventsScheduled persistence.
 *
 * Scheduled rows are replaced as a complete sailing-day set after schedule
 * reloads. The reconciliation stays table-local because it is simple storage
 * behavior rather than ferry-domain logic.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import type { ConvexScheduledDockEvent } from "./schemas";

/**
 * Replaces scheduled dock rows for one sailing day with the supplied rows.
 *
 * Loads stored rows by sailing day, deletes rows missing from the incoming
 * set, inserts new rows, and replaces only rows with visible field changes.
 * Unchanged rows are skipped so document identity and subscriptions stay stable.
 *
 * @param ctx - Convex mutation context exposing database writes
 * @param SailingDay - Sailing day whose scheduled rows are fully replaced
 * @param nextRows - Complete replacement scheduled rows for the sailing day
 * @returns Promise resolving with no payload after reconciliation completes
 */
const upsertScheduledRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ConvexScheduledDockEvent[]
): Promise<void> => {
  const existingRows = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();

  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));
  const nextKeys = new Set(nextRows.map((row) => row.Key));

  // Delete absent rows in parallel; ordering does not affect downstream rows.
  await Promise.all(
    existingRows
      .filter((row) => !nextKeys.has(row.Key))
      .map((row) => ctx.db.delete(row._id))
  );

  // Upsert sequentially so equality checks read consistent state per row.
  for (const nextRow of nextRows) {
    const existingRow = existingByKey.get(nextRow.Key);

    if (existingRow === undefined) {
      await ctx.db.insert("eventsScheduled", nextRow);
      continue;
    }

    if (scheduledRowsEqual(existingRow, nextRow)) {
      continue;
    }

    await ctx.db.replace(existingRow._id, nextRow);
  }
};

/**
 * Compares scheduled rows while ignoring Convex document metadata and UpdatedAt.
 *
 * UpdatedAt is reload churn, not a viewer-visible schedule change, so equality
 * intentionally skips it. Optional scheduled fields use strict Convex optional
 * semantics: omitted IsLastArrivalOfSailingDay remains distinct from false
 * because both values can be stored and observed downstream.
 *
 * @param left - Stored eventsScheduled document
 * @param right - Incoming validator-shaped scheduled row
 * @returns True when no viewer-visible scheduled field differs
 */
const scheduledRowsEqual = (
  left: Doc<"eventsScheduled">,
  right: ConvexScheduledDockEvent
): boolean =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.NextTerminalAbbrev === right.NextTerminalAbbrev &&
  left.EventType === right.EventType &&
  left.EventScheduledTime === right.EventScheduledTime &&
  left.IsLastArrivalOfSailingDay === right.IsLastArrivalOfSailingDay;

export { upsertScheduledRowsForSailingDay };
