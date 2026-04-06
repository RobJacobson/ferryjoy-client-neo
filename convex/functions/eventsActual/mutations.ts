/**
 * Internal mutations for the normalized `eventsActual` table.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { buildActualBoundaryEventFromPatch } from "domain/vesselTimeline/normalizedEvents";
import { actualBoundaryRowsEqual } from "shared/actualBoundaryRowsEqual";
import { actualBoundaryPatchSchema } from "./schemas";

/**
 * Applies sparse actual-time boundary patches emitted by `vesselTrips`.
 *
 * These are incremental overlays, not full-day replacements, so the mutation
 * upserts only the affected keys and skips no-op rewrites.
 *
 * @param args.Patches - Departure and arrival patches keyed by segment
 * @returns `null`
 */
export const projectActualBoundaryPatches = internalMutation({
  args: {
    Patches: v.array(actualBoundaryPatchSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertActualBoundaryPatches(ctx, args.Patches);

    return null;
  },
});

const upsertActualBoundaryPatches = async (
  ctx: MutationCtx,
  patches: Array<Infer<typeof actualBoundaryPatchSchema>>
) => {
  const updatedAt = Date.now();
  const nextRowsByKey = new Map(
    patches.map((patch) => {
      const row = buildActualBoundaryEventFromPatch(patch, updatedAt);
      return [row.Key, row] as const;
    })
  );

  for (const [Key, candidateRow] of nextRowsByKey) {
    const existing = await ctx.db
      .query("eventsActual")
      .withIndex("by_key", (q) => q.eq("Key", Key))
      .unique();
    const nextRow = mergeWithExistingActualRow(existing, candidateRow);

    if (!existing) {
      await ctx.db.insert("eventsActual", nextRow);
      continue;
    }

    if (actualBoundaryRowsEqual(existing, nextRow)) {
      continue;
    }

    await ctx.db.replace(existing._id, nextRow);
  }
};

const mergeWithExistingActualRow = (
  existing: {
    EventActualTime?: number;
  } | null,
  nextRow: ReturnType<typeof buildActualBoundaryEventFromPatch>
) => ({
  ...nextRow,
  EventOccurred: true as const,
  EventActualTime: nextRow.EventActualTime ?? existing?.EventActualTime,
});
