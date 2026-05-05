/**
 * Writes to eventsPredicted: sparse batch upserts from trip and event projection plus
 * depart-next actualization when a departure boundary is observed.
 */

import type { MutationCtx } from "_generated/server";
import { DEPART_NEXT_ML_PREDICTION_TYPES } from "domain/events/predicted/departNextActualization";
import {
  type MergedPredictedDockScope,
  mergePredictedDockWriteBatchesByScope,
  type PredictedDockScopeReconciliationPlan,
  planPredictedDockScopeReconciliation,
} from "domain/events/predicted/reconcilePredictedDockBatches";
import { getRoundedMinutesDelta } from "shared/time";
import type { ConvexPredictedDockWriteRow } from "./schemas";

/**
 * Reconciles predicted dock rows for one or more vessel and sailing-day scopes.
 *
 * Merges batches that may arrive from multiple trips within the same flush, loads the
 * live database slice for each scope, then applies delete, insert, and replace operations
 * derived from planPredictedDockScopeReconciliation so sparse feeds remain safe.
 *
 * @param ctx - Convex mutation context
 * @param batches - Sparse prediction batches keyed by VesselAbbrev and SailingDay
 * @returns Resolves with no value after every scope is processed
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
    if (!shouldReconcilePredictedScope(batch)) {
      continue;
    }

    const existingRows = await loadPredictedRowsForScope(ctx, batch);
    const plan = planPredictedDockScopeReconciliation({
      scope: batch,
      existingRows,
      updatedAt,
    });

    await applyPredictedDockReconciliationPlan(ctx, plan);
  }
};

/**
 * Returns whether a merged prediction scope needs storage reconciliation.
 *
 * @param batch - Merged vessel and sailing-day prediction batch
 * @returns True when the batch targets at least one dock boundary key
 */
const shouldReconcilePredictedScope = (
  batch: MergedPredictedDockScope
): boolean => batch.TargetKeys.size > 0;

/**
 * Loads the current predicted rows for one vessel and sailing-day scope.
 *
 * @param ctx - Convex mutation context
 * @param batch - Scope whose stored prediction rows should be reconciled
 * @returns Existing eventsPredicted rows for the batch scope
 */
const loadPredictedRowsForScope = (
  ctx: MutationCtx,
  batch: MergedPredictedDockScope
) =>
  ctx.db
    .query("eventsPredicted")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q
        .eq("VesselAbbrev", batch.VesselAbbrev)
        .eq("SailingDay", batch.SailingDay)
    )
    .collect();

/**
 * Applies a predicted-row reconciliation plan in delete, insert, replace order.
 *
 * @param ctx - Convex mutation context
 * @param plan - Domain-planned persistence operations for one prediction scope
 * @returns Resolves when all operations have been applied
 */
const applyPredictedDockReconciliationPlan = async (
  ctx: MutationCtx,
  plan: PredictedDockScopeReconciliationPlan
): Promise<void> => {
  for (const id of plan.deletes) {
    await ctx.db.delete(id);
  }

  for (const row of plan.inserts) {
    await ctx.db.insert("eventsPredicted", row);
  }

  for (const replacement of plan.replacements) {
    await ctx.db.replace(replacement.existingId, replacement.row);
  }
};

/**
 * Actualizes depart-next ML predictions after physical departure confirms the next leg.
 *
 * Queries each depart-next ML PredictionType at depKey, skips rows already carrying Actual,
 * and patches Actual plus DeltaTotal minutes derived from predicted versus observed departure.
 *
 * @param ctx - Convex mutation context
 * @param depKey - Dock boundary Key shared with scheduled and actual tables
 * @param actualMs - Measured departure instant for the next leg in epoch milliseconds
 * @returns True when at least one row was patched
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
