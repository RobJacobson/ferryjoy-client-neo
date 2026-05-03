/**
 * Writes to `eventsPredicted`: sparse batch upserts from trip/timeline code and
 * depart-next actualization when a departure boundary is observed.
 */

import type { MutationCtx } from "_generated/server";
import { DEPART_NEXT_ML_PREDICTION_TYPES } from "domain/events/predicted/departNextActualization";
import {
  mergePredictedDockWriteBatchesByScope,
  planPredictedDockScopeReconciliation,
} from "domain/events/predicted/reconcilePredictedDockBatches";
import { getRoundedMinutesDelta } from "shared/time";
import type { ConvexPredictedDockWriteRow } from "./schemas";

/**
 * Reconciles predicted dock rows for one or more vessel/sailing-day scopes.
 *
 * Merges incoming batches per scope, deletes rows in `TargetKeys` omitted from
 * the payload (except guarded depart-next ML rows), then inserts or replaces
 * the remainder with a shared `UpdatedAt` clock.
 *
 * @param ctx - Convex mutation context
 * @param batches - Sparse write groups from timeline / orchestrator persistence
 */
export const upsertPredictedDockBatches = async (
  ctx: MutationCtx,
  batches: ReadonlyArray<{
    VesselAbbrev: string;
    SailingDay: string;
    TargetKeys: string[];
    Rows: ConvexPredictedDockWriteRow[];
  }>
): Promise<void> => {
  const updatedAt = Date.now();
  const batchesByScope = mergePredictedDockWriteBatchesByScope(batches);

  for (const batch of batchesByScope.values()) {
    if (batch.TargetKeys.size === 0) {
      continue;
    }

    // Reads the full vessel-day slice so deletes and upserts reconcile against live storage.
    const existingRows = await ctx.db
      .query("eventsPredicted")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", batch.VesselAbbrev)
          .eq("SailingDay", batch.SailingDay)
      )
      .collect();

    const plan = planPredictedDockScopeReconciliation({
      scope: batch,
      existingRows,
      updatedAt,
    });

    for (const id of plan.deletes) {
      await ctx.db.delete(id);
    }

    for (const row of plan.inserts) {
      await ctx.db.insert("eventsPredicted", row);
    }

    for (const replacement of plan.replacements) {
      await ctx.db.replace(replacement.existingId, replacement.row);
    }
  }
};

/**
 * For each depart-next ML prediction type at `depKey`, sets `Actual` and
 * `DeltaTotal` when the row exists and is not yet actualized.
 *
 * @param ctx - Convex mutation context
 * @param depKey - Departure boundary key shared with trip/event keys
 * @param actualMs - Observed departure time (epoch ms)
 * @returns Whether any document was patched (for tests and tight call paths)
 */
export const patchDepartNextMlRowsForDepBoundary = async (
  ctx: MutationCtx,
  depKey: string,
  actualMs: number
): Promise<boolean> => {
  let anyUpdated = false;

  // Patches each depart-next ML row type at depKey when present and not yet actualized.
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
