/**
 * Persistence entrypoints for `eventsActual`: sparse upserts from orchestrator
 * pings (`upsertActualDockRows`) and full-day reconciliation when schedule
 * hydration replaces one sailing day (`replaceActualRowsForSailingDay`).
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
 * Persists sparse actual-dock rows keyed by physical `EventKey`.
 *
 * Called from `persistVesselUpdates` with timeline-projected rows. Collapses
 * duplicate keys in one flush via `dedupeByEventKey`, then inserts or replaces
 * only when `actualDockRowsEqual` reports a visible change so `_creationTime` and
 * bandwidth stay stable for no-op pings.
 *
 * @param ctx - Convex mutation context
 * @param rows - Normalized rows matching `eventsActualSchema` (may repeat keys)
 */
export const upsertActualDockRows = async (
  ctx: MutationCtx,
  rows: ConvexActualDockEvent[]
): Promise<void> => {
  for (const row of dedupeByEventKey(rows)) {
    // Reads the stored row for this EventKey, if any, to choose insert vs replace.
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", row.EventKey))
      .unique();

    // Inserts when this EventKey has never been written - no prior row to diff.
    if (!existing) {
      await ctx.db.insert("eventsActual", row);
      continue;
    }

    // Skips replace when `actualDockRowsEqual` reports no observable field change.
    if (actualDockRowsEqual(existing, row)) {
      continue;
    }

    // Replaces when the same EventKey carries a changed trip/time/terminal snapshot.
    await ctx.db.replace(existing._id, row);
  }
};

/**
 * Reconciles one sailing day by replacing the stored slice with a full hydrated candidate set.
 *
 * Deletes rows whose keys disappear from `finalRows` unless they are grandfathered
 * ping-only rows (no `ScheduleKey`). Then applies each hydrated row through
 * `upsertActualDockRows` so insert, equality skip, and replace match sparse upserts.
 *
 * @param ctx - Convex mutation context
 * @param SailingDay - Service day `YYYY-MM-DD` being reconciled
 * @param finalRows - Complete candidate rows for that day after schedule hydration
 */
export const replaceActualRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  finalRows: ConvexActualDockEvent[]
): Promise<void> => {
  // Reads every stored row for this day (inputs to delete set and grandfather detection).
  const existingRows = await ctx.db
    .query("eventsActual")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();

  // Indexes hydrated candidates by EventKey (last row wins if `finalRows` repeats a key).
  const nextByEventKey = finalRowsByEventKey(finalRows);

  // Builds allow-listed keys: hydrated keys plus ping-only legacy keys missing from `finalRows`.
  const surviveEventKeys = buildSurviveEventKeySet(
    nextByEventKey,
    existingRows
  );

  // Drops rows that should disappear before applying the new day slice from `finalRows`.
  await deleteActualRowsOutsideAllowList(ctx, existingRows, surviveEventKeys);

  // Writes each candidate row: insert new keys, skip or replace when stored state differs.
  const hydratedRows = [...nextByEventKey.values()];
  await upsertActualDockRows(ctx, hydratedRows);
};

/**
 * Deduplicates actual dock rows by physical `EventKey`, keeping the last copy.
 *
 * Orchestrator timeline assembly concatenates completed-branch and current-branch
 * writes (`mergePingEventWrites`) without merging on `EventKey`. Calling this inside
 * `upsertActualDockRows` yields deterministic last-wins semantics and avoids double
 * writes when both branches emit the same boundary.
 *
 * @param rows - Sparse batch from trip/timeline projection (may repeat keys)
 * @returns One row per distinct `EventKey`, in insertion order of first occurrence per key after collapse
 */
const dedupeByEventKey = (
  rows: ConvexActualDockEvent[]
): ConvexActualDockEvent[] =>
  // Folds into a Map so repeated keys pick up the last payload, then collects values.
  Array.from(
    rows
      .reduce(
        (map, row) => map.set(row.EventKey, row),
        new Map<string, ConvexActualDockEvent>()
      )
      .values()
  );

/**
 * Indexes a full hydrated day slice by `EventKey` for replace reconciliation.
 *
 * Duplicate keys in `finalRows` collapse to the last row, matching `Map` semantics.
 *
 * @param finalRows - Candidate rows from schedule hydration (possibly duplicate keys)
 */
const finalRowsByEventKey = (
  finalRows: ConvexActualDockEvent[]
): Map<string, ConvexActualDockEvent> =>
  new Map(finalRows.map((row) => [row.EventKey, row]));

/**
 * Builds the set of `EventKey`s that still exist in the database after the delete pass.
 *
 * Seeds from every key in the hydrated slice, then extends with stored rows that
 * were captured only from vessel pings (no `ScheduleKey`) so schedule hydration
 * cannot delete live-only history when those keys are absent from `finalRows`.
 *
 * @param nextByEventKey - Hydrated candidate rows keyed by `EventKey`
 * @param existingRows - Documents currently stored for this sailing day
 * @returns Keys to keep; rows not listed here are deleted before upserts run
 */
const buildSurviveEventKeySet = (
  nextByEventKey: Map<string, ConvexActualDockEvent>,
  existingRows: Doc<"eventsActual">[]
): Set<string> => {
  const survive = new Set(nextByEventKey.keys());
  // Grandfathers ping-only rows so hydration does not erase keys missing from `finalRows`.
  for (const row of existingRows) {
    if (!nextByEventKey.has(row.EventKey) && row.ScheduleKey === undefined) {
      survive.add(row.EventKey);
    }
  }
  return survive;
};

/**
 * Deletes every stored row whose `EventKey` is missing from `allowKeys`.
 *
 * Runs after computing the survival set and before `upsertActualDockRows` so
 * removed boundaries disappear before hydrated rows are merged back.
 *
 * @param ctx - Convex mutation context
 * @param existingRows - Snapshot from the initial full-day read for this reconcile
 * @param allowKeys - EventKeys retained (hydrated plus grandfathered)
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
