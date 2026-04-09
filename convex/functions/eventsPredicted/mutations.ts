/**
 * Internal mutations for the normalized `eventsPredicted` table.
 */

import type { Doc } from "_generated/dataModel";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { buildVesselSailingDayScopeKey } from "../../shared/keys";
import {
  type ConvexPredictedBoundaryEvent,
  type ConvexPredictedBoundaryProjectionRow,
  predictedBoundaryCompositeKey,
  predictedBoundaryProjectionEffectSchema,
} from "./schemas";

/**
 * Applies sparse predicted-time boundary effects emitted by `vesselTrips`.
 *
 * Rows are identified by `(Key, PredictionType, PredictionSource)`. Stale rows
 * in the effect's target key set are deleted when not present in `Rows`.
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
        RowsByComposite: Map<string, ConvexPredictedBoundaryProjectionRow>;
      }
    >();

    for (const effect of args.Effects) {
      const scopeKey = buildVesselSailingDayScopeKey(
        effect.VesselAbbrev,
        effect.SailingDay
      );
      const existingScope = effectsByScope.get(scopeKey);

      if (existingScope) {
        for (const targetKey of effect.TargetKeys) {
          existingScope.TargetKeys.add(targetKey);
        }
        for (const row of effect.Rows) {
          existingScope.RowsByComposite.set(
            predictedBoundaryCompositeKey(row),
            row
          );
        }
        continue;
      }

      effectsByScope.set(scopeKey, {
        VesselAbbrev: effect.VesselAbbrev,
        SailingDay: effect.SailingDay,
        TargetKeys: new Set(effect.TargetKeys),
        RowsByComposite: new Map(
          effect.Rows.map((row) => [predictedBoundaryCompositeKey(row), row])
        ),
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

      const incomingIds = new Set(effect.RowsByComposite.keys());

      for (const existing of existingRows) {
        if (!effect.TargetKeys.has(existing.Key)) {
          continue;
        }
        const id = predictedBoundaryCompositeKey(existing);
        if (!incomingIds.has(id)) {
          await ctx.db.delete(existing._id);
        }
      }

      for (const row of effect.RowsByComposite.values()) {
        if (!effect.TargetKeys.has(row.Key)) {
          continue;
        }

        const nextRow: ConvexPredictedBoundaryEvent = {
          ...row,
          UpdatedAt: updatedAt,
        };

        const existing = await ctx.db
          .query("eventsPredicted")
          .withIndex("by_key_type_and_source", (q) =>
            q
              .eq("Key", row.Key)
              .eq("PredictionType", row.PredictionType)
              .eq("PredictionSource", row.PredictionSource)
          )
          .unique();

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
  left.PredictionSource === right.PredictionSource &&
  left.Actual === right.Actual &&
  left.DeltaTotal === right.DeltaTotal;
