/**
 * Internal mutations for scheduled-event table reconciliation.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { materializeOrchestratorScheduleSnapshot } from "functions/vesselOrchestrator/materializeScheduleSnapshot";
import type { ConvexScheduledDockEvent } from "./schemas";

/**
 * Upsert the scheduled-event backbone rows for one sailing day using the
 * supplied slice as the complete source of truth.
 *
 * @param ctx - Convex mutation context
 * @param SailingDay - Service day being fully replaced
 * @param nextRows - Replacement scheduled boundary rows for the sailing day
 */
export const upsertScheduledRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ConvexScheduledDockEvent[]
): Promise<void> => {
  // Load all existing rows for the sailing day
  const existingRows = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();

  // Create a map of existing rows by key for quick lookup
  const existingByKey = new Map(existingRows.map((row) => [row.Key, row]));

  // Create a set of keys from the new rows for quick lookup
  const nextKeys = new Set(nextRows.map((row) => row.Key));

  // Delete rows that are no longer present in the new slice
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

    // If the row is present in the existing slice and is equal to the new row, skip it
    if (scheduledRowsEqual(existing, nextRow)) {
      continue;
    }

    // If the row is present in the existing slice and is not equal to the new row, update it
    await ctx.db.replace(existing._id, nextRow);
  }

  const snapshot = materializeOrchestratorScheduleSnapshot(
    SailingDay,
    nextRows
  );
  const existingSnapshot = await ctx.db
    .query("vesselOrchestratorScheduleSnapshots")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .unique();

  if (existingSnapshot) {
    await ctx.db.replace(existingSnapshot._id, snapshot);
  } else {
    await ctx.db.insert("vesselOrchestratorScheduleSnapshots", snapshot);
  }
};

/**
 * Compare scheduled backbone rows while ignoring Convex metadata fields.
 *
 * @param left - Currently stored scheduled boundary row
 * @param right - Candidate scheduled boundary row
 * @returns True when no replacement write is needed
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
