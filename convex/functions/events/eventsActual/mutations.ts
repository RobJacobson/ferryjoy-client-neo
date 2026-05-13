/**
 * Internal mutation helpers for eventsActual persistence.
 *
 * Actual rows are sparse observations keyed by physical event identity. The
 * table module owns the small upsert loop directly so unchanged ping payloads
 * do not churn document identity or timeline subscriptions.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import type { ConvexActualDockEvent } from "./schemas";

type ReplaceActualRowsForSailingDayOptions = {
  preserveAbsentTripKeys?: ReadonlySet<string>;
};

/**
 * Upserts sparse actual dock rows by physical EventKey.
 *
 * Incoming duplicate rows collapse to the last row for each EventKey. Each
 * distinct row is looked up by the physical key, inserted when missing, replaced
 * when visible fields changed, and skipped when only metadata or UpdatedAt
 * differs.
 *
 * @param ctx - Convex mutation context exposing database writes
 * @param rows - Normalized actual dock rows from realtime orchestration
 * @returns Promise resolving with no payload after reconciliation completes
 */
const upsertActualDockRows = async (
  ctx: MutationCtx,
  rows: ConvexActualDockEvent[]
): Promise<void> => {
  const dedupedRows = dedupeActualRowsByEventKey(rows);

  for (const row of dedupedRows) {
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", row.EventKey))
      .unique();

    if (existing === null) {
      await ctx.db.insert("eventsActual", row);
      continue;
    }

    if (areActualRowsEqual(existing, row)) {
      continue;
    }

    await ctx.db.replace(existing._id, row);
  }
};

/**
 * Replaces actual dock rows for one sailing day.
 *
 * Static reload owns the schedule-aligned sailing day, so rows absent from the
 * incoming normalized payload are deleted unless their TripKey is known to be a
 * current physical-only trip for the day.
 *
 * @param ctx - Convex mutation context exposing database writes
 * @param SailingDay - Service day whose actual rows should be replaced
 * @param rows - Normalized actual dock rows for that sailing day
 * @param options.preserveAbsentTripKeys - Physical-only TripKeys whose absent
 * rows should survive the scheduled reload replacement pass
 * @returns Promise resolving with no payload after reconciliation completes
 */
const replaceActualRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  rows: ConvexActualDockEvent[],
  options: ReplaceActualRowsForSailingDayOptions = {}
): Promise<void> => {
  const existingRows = await ctx.db
    .query("eventsActual")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();
  const nextRows = dedupeActualRowsByEventKey(rows);
  const nextEventKeys = new Set(nextRows.map((row) => row.EventKey));

  for (const existing of existingRows) {
    if (
      !nextEventKeys.has(existing.EventKey) &&
      !options.preserveAbsentTripKeys?.has(existing.TripKey)
    ) {
      await ctx.db.delete(existing._id);
    }
  }

  await upsertActualDockRows(ctx, nextRows);
};

/**
 * Deduplicates actual dock rows by EventKey while keeping the last payload.
 *
 * @param rows - Incoming actual rows that may repeat physical keys
 * @returns One actual row per EventKey after last-row-wins collapse
 */
const dedupeActualRowsByEventKey = (
  rows: ConvexActualDockEvent[]
): ConvexActualDockEvent[] => {
  const rowsByEventKey = new Map<string, ConvexActualDockEvent>();

  for (const row of rows) {
    rowsByEventKey.set(row.EventKey, row);
  }

  return Array.from(rowsByEventKey.values());
};

/**
 * Compares actual rows while ignoring Convex metadata and UpdatedAt churn.
 *
 * EventOccurred is compared by effective occurrence state so persisted rows with
 * EventOccurred true match sparse rows that omit the flag when EventActualTime
 * is present. Actual-time changes are still compared separately.
 *
 * @param left - Stored eventsActual document
 * @param right - Incoming validator-shaped actual row
 * @returns True when no comparable actual field differs
 */
const areActualRowsEqual = (
  left: Doc<"eventsActual">,
  right: ConvexActualDockEvent
): boolean =>
  left.EventKey === right.EventKey &&
  left.TripKey === right.TripKey &&
  left.EventType === right.EventType &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.EventActualTime === right.EventActualTime &&
  getEffectiveEventOccurred(left) === getEffectiveEventOccurred(right);

/**
 * Resolves the occurrence state clients observe from an actual row.
 *
 * @param row - Actual row-like value with optional occurrence fields
 * @returns True when the row carries occurrence evidence
 */
const getEffectiveEventOccurred = (row: {
  EventOccurred?: true;
  EventActualTime?: number;
}): boolean => row.EventOccurred === true || row.EventActualTime !== undefined;

export { replaceActualRowsForSailingDay, upsertActualDockRows };
