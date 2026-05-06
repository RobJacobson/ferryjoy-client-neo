/**
 * Internal mutation helpers for eventsScheduled persistence.
 *
 * Scheduled rows are replaced as a complete sailing-day slice after schedule
 * reloads. The reconciliation stays table-local because it is simple storage
 * behavior rather than ferry-domain logic.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import type { ConvexScheduledDockEvent } from "./schemas";

/**
 * Replaces scheduled dock rows for one sailing day with the supplied slice.
 *
 * Loads stored rows by sailing day, deletes rows missing from the incoming
 * slice, inserts new rows, and replaces only rows with visible field changes.
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

  await Promise.all(
    existingRows
      .filter((row) => !nextKeys.has(row.Key))
      .map((row) => ctx.db.delete(row._id))
  );

  for (const nextRow of nextRows) {
    const existingRow = existingByKey.get(nextRow.Key);

    if (existingRow === undefined) {
      await ctx.db.insert("eventsScheduled", nextRow);
      continue;
    }

    if (areScheduledRowsEqual(existingRow, nextRow)) {
      continue;
    }

    await ctx.db.replace(existingRow._id, nextRow);
  }
};

/**
 * Compares scheduled rows while ignoring Convex document metadata.
 *
 * The optional last-arrival marker is compared with Convex optional semantics:
 * an omitted value is distinct from false because both are valid stored row
 * shapes and downstream code can observe that field.
 *
 * @param left - Stored eventsScheduled document
 * @param right - Incoming validator-shaped scheduled row
 * @returns True when no comparable scheduled field differs
 */
const areScheduledRowsEqual = (
  left: Doc<"eventsScheduled">,
  right: ConvexScheduledDockEvent
): boolean =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.UpdatedAt === right.UpdatedAt &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.NextTerminalAbbrev === right.NextTerminalAbbrev &&
  left.EventType === right.EventType &&
  left.EventScheduledTime === right.EventScheduledTime &&
  left.IsLastArrivalOfSailingDay === right.IsLastArrivalOfSailingDay;

export { upsertScheduledRowsForSailingDay };
