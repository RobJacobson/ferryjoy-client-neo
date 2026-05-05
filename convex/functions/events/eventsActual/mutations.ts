/**
 * Persistence entrypoints for eventsActual: sparse upserts from orchestrator
 * pings (upsertActualDockRows) and full-day reconciliation when schedule
 * hydration replaces one sailing day (replaceActualRowsForSailingDay).
 *
 * Private helpers dedupe ping batches, index hydrated slices, compute delete
 * allow-lists with grandfather rules, and route day-wide writes through the same
 * upsert path as sparse updates.
 */

import type { MutationCtx } from "_generated/server";
import {
  dedupeActualRowsByEventKey,
  planActualDockRowUpsert,
  planActualRowsForSailingDayReplacement,
} from "./planActualRows";
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
  for (const row of dedupeActualRowsByEventKey(rows)) {
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_event_key", (q) => q.eq("EventKey", row.EventKey))
      .unique();
    const plan = planActualDockRowUpsert(existing, row);

    if (plan.operation === "insert") {
      await ctx.db.insert("eventsActual", plan.row);
      continue;
    }

    if (plan.operation === "replace") {
      await ctx.db.replace(plan.existingId, plan.row);
    }
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
  const plan = planActualRowsForSailingDayReplacement(existingRows, finalRows);

  await Promise.all(
    plan.deletes.map((existingId) => ctx.db.delete(existingId))
  );

  await upsertActualDockRows(ctx, plan.upsertRows);
};

export { replaceActualRowsForSailingDay, upsertActualDockRows };
