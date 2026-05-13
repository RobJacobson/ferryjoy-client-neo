/**
 * Internal mutation helpers for eventsPredicted persistence.
 *
 * Predicted rows are reconciled as sparse vessel and sailing-day batches from
 * realtime orchestration. The table owns storage decisions directly while the
 * shared domain helper supplies only the stable composite prediction identity.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { predictedDockCompositeKey } from "domain/events/predicted";
import { buildVesselSailingDayScopeKey } from "shared/keys";
import { getRoundedMinutesDelta } from "shared/time";
import type {
  ConvexPredictedDockEvent,
  ConvexPredictedDockWriteRow,
} from "./schemas";

const DEPART_NEXT_ML_PREDICTION_TYPES = [
  "AtDockDepartNext",
  "AtSeaDepartNext",
] as const;

type PredictedDockWriteBatchLike = {
  VesselAbbrev: string;
  SailingDay: string;
  TargetKeys: string[];
  Rows: ConvexPredictedDockWriteRow[];
};

type MergedPredictedDockScope = {
  VesselAbbrev: string;
  SailingDay: string;
  TargetKeys: Set<string>;
  RowsByComposite: Map<string, ConvexPredictedDockWriteRow>;
};

/**
 * Reconciles sparse predicted dock batches by vessel and sailing day.
 *
 * Batches for the same scope are merged before one indexed read. Only targeted
 * boundary keys are reconciled, with omitted depart-next ML rows preserved
 * unless a same key and source replacement family arrives.
 *
 * @param ctx - Convex mutation context exposing database writes
 * @param batches - Sparse predicted dock write batches from orchestration
 * @returns Promise resolving with no payload after reconciliation completes
 */
const upsertPredictedDockBatches = async (
  ctx: MutationCtx,
  batches: ReadonlyArray<PredictedDockWriteBatchLike>
): Promise<void> => {
  const updatedAt = Date.now();
  const scopesByKey = new Map<string, MergedPredictedDockScope>();

  // Merge same-scope batches so each vessel/day reads existing rows only once.
  for (const batch of batches) {
    const scopeKey = buildVesselSailingDayScopeKey(
      batch.VesselAbbrev,
      batch.SailingDay
    );
    const scope = scopesByKey.get(scopeKey);

    if (scope !== undefined) {
      for (const targetKey of batch.TargetKeys) {
        scope.TargetKeys.add(targetKey);
      }
      for (const row of batch.Rows) {
        scope.RowsByComposite.set(predictedDockCompositeKey(row), row);
      }
      continue;
    }

    scopesByKey.set(scopeKey, {
      VesselAbbrev: batch.VesselAbbrev,
      SailingDay: batch.SailingDay,
      TargetKeys: new Set(batch.TargetKeys),
      RowsByComposite: new Map(
        batch.Rows.map((row) => [predictedDockCompositeKey(row), row])
      ),
    });
  }

  for (const scope of scopesByKey.values()) {
    if (scope.TargetKeys.size === 0) {
      continue;
    }

    const existingRows = await ctx.db
      .query("eventsPredicted")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", scope.VesselAbbrev)
          .eq("SailingDay", scope.SailingDay)
      )
      .collect();

    const existingByComposite = new Map(
      existingRows.map((row) => [predictedDockCompositeKey(row), row])
    );
    const incomingCompositeKeys = new Set(scope.RowsByComposite.keys());
    const incomingSourceKeys = buildIncomingSourceKeys(
      scope.RowsByComposite.values()
    );

    // Delete absent existing rows except those depart-next preservation guards.
    for (const existing of existingRows) {
      if (!scope.TargetKeys.has(existing.Key)) {
        continue;
      }

      const compositeKey = predictedDockCompositeKey(existing);
      if (incomingCompositeKeys.has(compositeKey)) {
        continue;
      }

      if (shouldPreserveOmittedDepartNextMlRow(existing, incomingSourceKeys)) {
        continue;
      }

      await ctx.db.delete(existing._id);
      existingByComposite.delete(compositeKey);
    }

    // Insert or replace each incoming row within the scope's targeted keys.
    for (const row of scope.RowsByComposite.values()) {
      if (!scope.TargetKeys.has(row.Key)) {
        continue;
      }

      const nextRow: ConvexPredictedDockEvent = {
        ...row,
        UpdatedAt: updatedAt,
      };
      const existing = existingByComposite.get(predictedDockCompositeKey(row));

      if (existing === undefined) {
        await ctx.db.insert("eventsPredicted", nextRow);
        continue;
      }

      if (arePredictedRowsEqual(existing, nextRow)) {
        continue;
      }

      await ctx.db.replace(existing._id, nextRow);
    }
  }
};

/**
 * Patches depart-next ML predictions for a confirmed departure boundary.
 *
 * Both depart-next ML prediction types are queried by key, type, and source.
 * Rows that are missing or already actualized are skipped; remaining rows get
 * the observed actual time and rounded minute delta.
 *
 * @param ctx - Convex mutation context exposing database writes
 * @param depKey - Departure dock boundary key to actualize
 * @param actualMs - Observed departure timestamp in epoch milliseconds
 * @returns True when at least one predicted row was patched
 */
const patchDepartNextMlRowsForDepBoundary = async (
  ctx: MutationCtx,
  depKey: string,
  actualMs: number
): Promise<boolean> => {
  let didPatch = false;

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

    if (existing === null || existing.Actual !== undefined) {
      continue;
    }

    await ctx.db.patch(existing._id, {
      Actual: actualMs,
      DeltaTotal: getRoundedMinutesDelta(existing.EventPredictedTime, actualMs),
    });
    didPatch = true;
  }

  return didPatch;
};

/**
 * Compares predicted rows while ignoring Convex metadata and UpdatedAt churn.
 *
 * @param left - Stored eventsPredicted document
 * @param right - Incoming predicted row with a fresh UpdatedAt value
 * @returns True when every comparable predicted field is unchanged
 */
const arePredictedRowsEqual = (
  left: Doc<"eventsPredicted">,
  right: ConvexPredictedDockEvent
): boolean =>
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
 * Builds coarse key and source identities from incoming rows.
 *
 * @param rows - Incoming predicted rows in a merged scope
 * @returns Set of key and prediction-source identities
 */
const buildIncomingSourceKeys = (
  rows: Iterable<ConvexPredictedDockWriteRow>
): Set<string> => {
  const sourceKeys = new Set<string>();

  for (const row of rows) {
    sourceKeys.add(predictedSourceKey(row));
  }

  return sourceKeys;
};

/**
 * Decides whether an omitted existing row should survive reconciliation.
 *
 * Depart-next ML rows are preserved during clears unless the incoming scope
 * carries another ML row for the same boundary key and prediction source.
 *
 * @param row - Existing targeted row absent from incoming composites
 * @param incomingSourceKeys - Incoming key and source identities for the scope
 * @returns True when the existing row should not be deleted
 */
const shouldPreserveOmittedDepartNextMlRow = (
  row: Doc<"eventsPredicted">,
  incomingSourceKeys: Set<string>
): boolean =>
  row.PredictionSource === "ml" &&
  DEPART_NEXT_ML_PREDICTION_TYPES.includes(
    row.PredictionType as (typeof DEPART_NEXT_ML_PREDICTION_TYPES)[number]
  ) &&
  !incomingSourceKeys.has(predictedSourceKey(row));

/**
 * Builds the replacement-family identity for depart-next preservation.
 *
 * @param row - Row-like value with Key and PredictionSource columns
 * @returns Composite string for key and prediction source
 */
const predictedSourceKey = (row: {
  Key: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionSource}`;

export { patchDepartNextMlRowsForDepBoundary, upsertPredictedDockBatches };
