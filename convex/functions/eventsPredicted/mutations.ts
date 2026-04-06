/**
 * Internal mutations for the normalized `eventsPredicted` table.
 */

import type { Doc } from "_generated/dataModel";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import {
  type ConvexPredictedBoundaryEvent,
  type ConvexPredictedBoundaryProjectionRow,
  predictedBoundaryProjectionEffectSchema,
} from "./schemas";

/**
 * Applies sparse predicted-time boundary effects emitted by `vesselTrips`.
 *
 * Each effect carries both the replacement rows and the key scope that should
 * exist afterwards, which lets the mutation delete stale predictions without
 * reloading unrelated vessels or sailing days.
 *
 * @param args.Effects - Prediction projection effects grouped by vessel/day scope
 * @returns `null`
 */
export const projectPredictedBoundaryEffects = internalMutation({
  args: {
    Effects: v.array(predictedBoundaryProjectionEffectSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const effectsByScope = new Map<
      string,
      {
        VesselAbbrev: string;
        SailingDay: string;
        TargetKeys: Set<string>;
        RowsByKey: Map<string, ConvexPredictedBoundaryProjectionRow>;
      }
    >();

    for (const effect of args.Effects) {
      // Multiple vessels in the same tick may emit overlapping prediction
      // effects for the same vessel/day scope. Merge them first so we only
      // read and rewrite that scope once.
      const scopeKey = `${effect.VesselAbbrev}:${effect.SailingDay}`;
      const existingScope = effectsByScope.get(scopeKey);

      if (existingScope) {
        for (const targetKey of effect.TargetKeys) {
          existingScope.TargetKeys.add(targetKey);
        }
        for (const row of effect.Rows) {
          existingScope.RowsByKey.set(row.Key, row);
        }
        continue;
      }

      effectsByScope.set(scopeKey, {
        VesselAbbrev: effect.VesselAbbrev,
        SailingDay: effect.SailingDay,
        TargetKeys: new Set(effect.TargetKeys),
        RowsByKey: new Map(effect.Rows.map((row) => [row.Key, row])),
      });
    }

    for (const effect of effectsByScope.values()) {
      if (effect.TargetKeys.size === 0) {
        continue;
      }

      const existingRows = await ctx.db
        .query("eventsPredicted")
        .withIndex("by_vessel_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", effect.VesselAbbrev)
            .eq("SailingDay", effect.SailingDay)
        )
        .collect();

      for (const existing of existingRows) {
        if (
          effect.TargetKeys.has(existing.Key) &&
          !effect.RowsByKey.has(existing.Key)
        ) {
          await ctx.db.delete(existing._id);
        }
      }

      for (const [Key, row] of effect.RowsByKey) {
        if (!effect.TargetKeys.has(Key)) {
          continue;
        }

        const nextRow = {
          ...row,
          UpdatedAt: updatedAt,
        };
        const existing = existingRows.find(
          (existingRow) => existingRow.Key === Key
        );

        if (!existing) {
          await ctx.db.insert("eventsPredicted", nextRow);
          continue;
        }

        if (predictedRowsEqual(existing, nextRow)) {
          continue;
        }

        await ctx.db.replace(existing._id, nextRow);
      }
    }

    return null;
  },
});

/**
 * Returns whether an existing predicted row matches the next write payload for
 * all user-visible fields (excluding system fields).
 *
 * @param left - Row currently stored in `eventsPredicted`
 * @param right - Candidate replacement including `UpdatedAt`
 * @returns True when no replace is needed
 */
const predictedRowsEqual = (
  left: Doc<"eventsPredicted">,
  right: ConvexPredictedBoundaryEvent
) =>
  left.Key === right.Key &&
  left.VesselAbbrev === right.VesselAbbrev &&
  left.SailingDay === right.SailingDay &&
  left.ScheduledDeparture === right.ScheduledDeparture &&
  left.TerminalAbbrev === right.TerminalAbbrev &&
  left.EventPredictedTime === right.EventPredictedTime &&
  left.PredictionType === right.PredictionType &&
  left.PredictionSource === right.PredictionSource;
