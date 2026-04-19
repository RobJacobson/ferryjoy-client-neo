/**
 * Internal mutations for the normalized `eventsPredicted` table.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { DEPART_NEXT_ML_PREDICTION_TYPES } from "domain/vesselOrchestration/shared";
import { buildVesselSailingDayScopeKey } from "shared/keys";
import { getRoundedMinutesDelta } from "shared/time";
import { predictedDockCompositeKey } from "./identity";
import {
  type ConvexPredictedDockEvent,
  type ConvexPredictedDockWriteRow,
  predictedDockWriteBatchSchema,
} from "./schemas";

/**
 * Applies sparse predicted-time dock write batches emitted by `vesselTrips`.
 *
 * Rows are identified by `(Key, PredictionType, PredictionSource)`. Stale rows
 * in the batch's target key set are deleted when not present in `Rows`.
 *
 * @param ctx - Convex internal mutation context
 * @param args - Mutation arguments containing grouped prediction batches
 * @returns `null`
 */
export const projectPredictedDockWriteBatches = internalMutation({
  args: {
    Batches: v.array(predictedDockWriteBatchSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    const batchesByScope = new Map<
      string,
      {
        VesselAbbrev: string;
        SailingDay: string;
        TargetKeys: Set<string>;
        RowsByComposite: Map<string, ConvexPredictedDockWriteRow>;
      }
    >();

    for (const batch of args.Batches) {
      const scopeKey = buildVesselSailingDayScopeKey(
        batch.VesselAbbrev,
        batch.SailingDay
      );
      const existingScope = batchesByScope.get(scopeKey);

      if (existingScope) {
        for (const targetKey of batch.TargetKeys) {
          existingScope.TargetKeys.add(targetKey);
        }
        for (const row of batch.Rows) {
          existingScope.RowsByComposite.set(
            predictedDockCompositeKey(row),
            row
          );
        }
        continue;
      }

      batchesByScope.set(scopeKey, {
        VesselAbbrev: batch.VesselAbbrev,
        SailingDay: batch.SailingDay,
        TargetKeys: new Set(batch.TargetKeys),
        RowsByComposite: new Map(
          batch.Rows.map((row) => [predictedDockCompositeKey(row), row])
        ),
      });
    }

    for (const batch of batchesByScope.values()) {
      if (batch.TargetKeys.size === 0) {
        continue;
      }

      const existingRows = await ctx.db
        .query("eventsPredicted")
        .withIndex("by_vessel_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", batch.VesselAbbrev)
            .eq("SailingDay", batch.SailingDay)
        )
        .collect();

      const existingByComposite = new Map(
        existingRows.map((row) => [predictedDockCompositeKey(row), row])
      );

      const incomingIds = new Set(batch.RowsByComposite.keys());

      for (const existing of existingRows) {
        if (!batch.TargetKeys.has(existing.Key)) {
          continue;
        }
        const id = predictedDockCompositeKey(existing);
        if (!incomingIds.has(id)) {
          await ctx.db.delete(existing._id);
          existingByComposite.delete(id);
        }
      }

      for (const row of batch.RowsByComposite.values()) {
        if (!batch.TargetKeys.has(row.Key)) {
          continue;
        }

        const nextRow: ConvexPredictedDockEvent = {
          ...row,
          UpdatedAt: updatedAt,
        };

        const id = predictedDockCompositeKey(row);
        const existing = existingByComposite.get(id);

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
  right: ConvexPredictedDockEvent
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

/**
 * Patches depart-next ML predictions for one departure boundary when rows
 * exist and have not yet been actualized.
 *
 * @param ctx - Mutation context
 * @param depKey - Departure boundary key
 * @param actualMs - Observed departure timestamp (epoch ms)
 * @returns True when at least one prediction row was updated
 */
export const actualizeDepartNextMlPredictions = async (
  ctx: MutationCtx,
  depKey: string,
  actualMs: number
): Promise<boolean> => {
  let anyUpdated = false;

  for (const predictionType of DEPART_NEXT_ML_PREDICTION_TYPES) {
    const existing = await ctx.db
      .query("eventsPredicted")
      .withIndex("by_key_type_and_source", (q) =>
        q
          .eq("Key", depKey)
          .eq("PredictionType", predictionType)
          .eq("PredictionSource", "ml")
      )
      .first();

    if (!existing || existing.Actual !== undefined) {
      continue;
    }

    await ctx.db.patch(existing._id, {
      Actual: actualMs,
      DeltaTotal: getRoundedMinutesDelta(existing.EventPredictedTime, actualMs),
    });
    anyUpdated = true;
  }

  return anyUpdated;
};
