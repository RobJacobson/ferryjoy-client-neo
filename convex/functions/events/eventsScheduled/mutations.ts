/**
 * Writes to eventsScheduled: full-day reconciliation when an adapter delivers
 * a complete planned dock sequence for one sailing day.
 */

import type { MutationCtx } from "_generated/server";
import { planScheduledRowsForSailingDay } from "./planScheduledRowsForSailingDay";
import type { ConvexScheduledDockEvent } from "./schemas";

/**
 * Replaces the stored scheduled slice for one SailingDay with the adapter output.
 *
 * Deletes keys the adapter no longer includes, inserts brand-new keys, and uses
 * scheduledRowsEqual to skip no-op replaces so _creationTime and subscription churn
 * stay stable when the schedule is unchanged.
 *
 * @param ctx - Convex mutation context
 * @param SailingDay - Service day YYYY-MM-DD being fully replaced
 * @param nextRows - Complete replacement rows for that day from the domain reload
 * @returns Resolves with no value when deletes, inserts, and replaces finish
 */
export const upsertScheduledRowsForSailingDay = async (
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ConvexScheduledDockEvent[]
): Promise<void> => {
  const existingRows = await ctx.db
    .query("eventsScheduled")
    .withIndex("by_sailing_day", (q) => q.eq("SailingDay", SailingDay))
    .collect();
  const plan = planScheduledRowsForSailingDay(existingRows, nextRows);

  await Promise.all(
    plan.deletes.map((existingId) => ctx.db.delete(existingId))
  );

  for (const row of plan.inserts) {
    await ctx.db.insert("eventsScheduled", row);
  }

  for (const replacement of plan.replacements) {
    await ctx.db.replace(replacement.existingId, replacement.row);
  }
};
