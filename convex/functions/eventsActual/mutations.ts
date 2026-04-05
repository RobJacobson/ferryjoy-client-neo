/**
 * Internal mutations for the normalized `eventsActual` table.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { buildActualBoundaryEventFromEffect } from "domain/vesselTimeline/normalizedEvents";
import { actualRowsEqual } from "./actualRowsEqual";
import { actualBoundaryEffectSchema } from "./projectionSchemas";

/**
 * Applies sparse actual-time boundary effects emitted by `vesselTrips`.
 *
 * These are incremental overlays, not full-day replacements, so the mutation
 * upserts only the affected keys and skips no-op rewrites.
 *
 * @param args.Effects - Departure and arrival actual effects keyed by segment
 * @returns `null`
 */
export const projectActualBoundaryEffects = internalMutation({
  args: {
    Effects: v.array(actualBoundaryEffectSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const nextRowsByKey = new Map(
      args.Effects.map((effect) => {
        const row = buildActualBoundaryEventFromEffect(effect, updatedAt);
        return [row.Key, row] as const;
      })
    );

    for (const [Key, nextRow] of nextRowsByKey) {
      const existing = await ctx.db
        .query("eventsActual")
        .withIndex("by_key", (q) => q.eq("Key", Key))
        .unique();

      if (!existing) {
        await ctx.db.insert("eventsActual", nextRow);
        continue;
      }

      if (actualRowsEqual(existing, nextRow)) {
        continue;
      }

      await ctx.db.replace(existing._id, nextRow);
    }

    return null;
  },
});
