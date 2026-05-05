/**
 * Persistence entrypoints for eventsActual: sparse upserts from orchestrator
 * pings and reload refreshes.
 *
 * Private helpers dedupe batches and route reload writes through the same
 * upsert path as sparse updates.
 */

import type { MutationCtx } from "_generated/server";
import {
  dedupeActualRowsByEventKey,
  planActualDockRowUpsert,
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

export { upsertActualDockRows };
