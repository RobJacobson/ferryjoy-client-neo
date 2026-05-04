/**
 * Persistence entrypoints for eventsActual: sparse upserts from orchestrator
 * pings (upsertActualDockRows) and full-day reconciliation when schedule
 * hydration replaces one sailing day (replaceActualRowsForSailingDay).
 *
 * Private helpers dedupe ping batches, index hydrated slices, compute delete
 * allow-lists with grandfather rules, and route day-wide writes through the same
 * upsert path as sparse updates.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { actualDockRowsEqual } from "functions/events/shared/actualDockRowsEqual";
import type { ConvexActualDockEvent } from "./schemas";

/**
 * Persists sparse actual-dock rows keyed by physical EventKey.
 *
 * Vessel orchestration can emit multiple pings per flush; dedupeByEventKey collapses
 * those to one payload per EventKey before touching the database. Inserts run only
 * on first sight of a key; otherwise replaces occur solely when actualDockRowsEqual
 * detects viewer-visible drift so unchanged pings skip writes entirely.
 *
 * @param ctx - Convex mutation context
 * @param rows - Normalized rows matching eventsActualSchema (may repeat keys)
 * @returns Resolves with no value when all rows are processed
 */
const upsertActualDockRows = async (
  ctx: MutationCtx,
  rows: ConvexActualDockEvent[]
): Promise<void> => {
  for (const row of dedupeByEventKey(rows)) {
    // Read the stored row for this EventKey, if any, to choose insert versus replace.
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", row.EventKey))
      .unique();

    // Insert when this EventKey has never been written; nothing to diff yet.
    if (!existing) {
      await ctx.db.insert("eventsActual", row);
      continue;
    }

    // Skip replace when equality reports no observable field change.
    if (actualDockRowsEqual(existing, row)) {
      continue;
    }

    // Replace when the same EventKey carries a changed trip, time, or terminal snapshot.
    await ctx.db.replace(existing._id, row);
  }
};

/**
 * Reconciles one sailing day by replacing the stored slice with a full hydrated
 * candidate set.
 *
 * Full-day hydration rebuilds schedule-derived boundaries from adapters; ping-only
 * rows without ScheduleKey must survive when hydration lacks those keys so live-only
 * evidence is not erased. Deletes execute before upserts so superseded keys disappear
 * atomically relative to the new slice loaded into upsertActualDockRows.
 *
 * @param ctx - Convex mutation context
 * @param SailingDay - Service day YYYY-MM-DD being reconciled
 * @param finalRows - Complete candidate rows for that day after schedule hydration
 * @returns Resolves with no value when deletes and upserts finish
 */
const replaceActualRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  finalRows: ConvexActualDockEvent[]
): Promise<void> => {
  // Snapshot stored rows for delete-set and grandfather detection.
  const existingRows = await ctx.db
    .query("eventsActual")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();

  // Last hydrated row wins when finalRows repeats an EventKey.
  const nextByEventKey = finalRowsByEventKey(finalRows);

  // Hydrated keys plus ping-only legacy keys absent from the hydrated slice.
  const surviveEventKeys = buildSurviveEventKeySet(
    nextByEventKey,
    existingRows
  );

  // Remove stale rows before applying the new slice from finalRows.
  await deleteActualRowsOutsideAllowList(ctx, existingRows, surviveEventKeys);

  // Upsert each candidate: insert new keys, skip or replace when stored state differs.
  const hydratedRows = [...nextByEventKey.values()];
  await upsertActualDockRows(ctx, hydratedRows);
};

/**
 * Deduplicates actual dock rows by physical EventKey, keeping the last copy.
 *
 * Orchestrator projection concatenates branch writes without merging on EventKey.
 * Map insertion order preserves last-wins semantics so the final payload matches the
 * chronologically last ping emitted within one orchestrator flush.
 *
 * @param rows - Sparse batch from trip event projection (may repeat keys)
 * @returns One row per distinct EventKey after collapse
 */
const dedupeByEventKey = (
  rows: ConvexActualDockEvent[]
): ConvexActualDockEvent[] =>
  Array.from(
    rows
      .reduce(
        (map, row) => map.set(row.EventKey, row),
        new Map<string, ConvexActualDockEvent>()
      )
      .values()
  );

/**
 * Indexes a full hydrated day slice by EventKey for replace reconciliation.
 *
 * Duplicate keys in finalRows collapse to the last row (Map semantics).
 * Hydration sometimes emits duplicates when adapters replay segments; this mirrors
 * sparse dedupe behavior so reconciliation compares against one candidate per key.
 *
 * @param finalRows - Candidate rows from schedule hydration (possibly duplicate keys)
 * @returns Map from EventKey to the winning candidate row
 */
const finalRowsByEventKey = (
  finalRows: ConvexActualDockEvent[]
): Map<string, ConvexActualDockEvent> =>
  new Map(finalRows.map((row) => [row.EventKey, row]));

/**
 * Builds the set of EventKeys that survive after the delete pass.
 *
 * Seeds from every key in the hydrated slice, then extends with stored rows that
 * came only from vessel pings with no ScheduleKey so hydration cannot drop
 * live-only history when those keys are absent from finalRows.
 * Grandfathered keys remain listed even without hydrated successors so deleteActualRowsOutsideAllowList skips them.
 *
 * @param nextByEventKey - Hydrated candidate rows keyed by EventKey
 * @param existingRows - Documents currently stored for this sailing day
 * @returns Keys to keep; rows not listed here are deleted before upserts run
 */
const buildSurviveEventKeySet = (
  nextByEventKey: Map<string, ConvexActualDockEvent>,
  existingRows: Doc<"eventsActual">[]
): Set<string> => {
  const survive = new Set(nextByEventKey.keys());

  // Keep grandfathered ping-only rows even when finalRows omits their keys.
  for (const row of existingRows) {
    if (!nextByEventKey.has(row.EventKey) && row.ScheduleKey === undefined) {
      survive.add(row.EventKey);
    }
  }
  return survive;
};

/**
 * Deletes stored rows whose EventKey is missing from allowKeys.
 *
 * Runs after computing the survival set and before upsertActualDockRows so
 * removed boundaries disappear before hydrated rows merge back.
 * Uses Promise.all over deletes so independent removals finish concurrently without
 * blocking the mutation longer than necessary.
 *
 * @param ctx - Convex mutation context
 * @param existingRows - Snapshot from the initial full-day read for this reconcile
 * @param allowKeys - EventKeys retained (hydrated plus grandfathered)
 * @returns Resolves with no value when deletes finish
 */
const deleteActualRowsOutsideAllowList = async (
  ctx: MutationCtx,
  existingRows: Doc<"eventsActual">[],
  allowKeys: Set<string>
): Promise<void> => {
  await Promise.all(
    existingRows
      .filter((row) => !allowKeys.has(row.EventKey))
      .map((row) => ctx.db.delete(row._id))
  );
};

export { replaceActualRowsForSailingDay, upsertActualDockRows };
