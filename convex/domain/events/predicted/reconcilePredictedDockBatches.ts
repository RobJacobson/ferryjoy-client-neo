/**
 * Pure reconciliation planning for eventsPredicted sparse write batches.
 *
 * The Convex mutation owns reads and writes; this module owns merge semantics,
 * stale deletion rules, depart-next preservation, and insert versus replace choice.
 */

import type { Id } from "_generated/dataModel";
import { buildVesselSailingDayScopeKey } from "shared/keys";
import { DEPART_NEXT_ML_PREDICTION_TYPES } from "./departNextActualization";
import {
  type ConvexPredictedDockEvent,
  type ConvexPredictedDockWriteRow,
  predictedDockCompositeKey,
} from "./schemas";

export type ExistingPredictedDockRow = ConvexPredictedDockEvent & {
  _id: Id<"eventsPredicted">;
};

export type MergedPredictedDockScope = {
  VesselAbbrev: string;
  SailingDay: string;
  TargetKeys: Set<string>;
  RowsByComposite: Map<string, ConvexPredictedDockWriteRow>;
};

export type PredictedDockWriteBatchLike = {
  VesselAbbrev: string;
  SailingDay: string;
  TargetKeys: string[];
  Rows: ConvexPredictedDockWriteRow[];
};

export type PredictedDockScopeReconciliationPlan = {
  inserts: ConvexPredictedDockEvent[];
  replacements: Array<{
    existingId: Id<"eventsPredicted">;
    row: ConvexPredictedDockEvent;
  }>;
  deletes: Array<Id<"eventsPredicted">>;
};

/**
 * Unifies multiple sparse batches into one merged scope per vessel and sailing day.
 *
 * Later batches extend TargetKeys unions and overwrite RowsByComposite when the same
 * predictedDockCompositeKey appears again so orchestrator flushes remain associative.
 *
 * @param batches - Ordered batches emitted across trips or ticks for the same day
 * @returns Map from sailing-day scope key to merged TargetKeys and deduped rows
 */
export const mergePredictedDockWriteBatchesByScope = (
  batches: ReadonlyArray<PredictedDockWriteBatchLike>
): Map<string, MergedPredictedDockScope> => {
  const batchesByScope = new Map<string, MergedPredictedDockScope>();

  for (const batch of batches) {
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
        existingScope.RowsByComposite.set(predictedDockCompositeKey(row), row);
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

  return batchesByScope;
};

/**
 * Derives insert, replace, and delete operations for one merged prediction scope.
 *
 * Deletes rows under TargetKeys that disappear from the incoming payload unless
 * shouldPreserveOmittedPrediction keeps in-flight depart-next ML rows alive during
 * sparse feeds. Inserts new composites; replaces when payloads differ field-wise.
 *
 * @param args.scope - Merged TargetKeys and Rows for one vessel sailing day
 * @param args.existingRows - Documents currently stored for that scope
 * @param args.updatedAt - Timestamp applied to inserted or replaced rows
 * @returns Structured plan consumed directly by the persistence mutation
 */
export const planPredictedDockScopeReconciliation = (args: {
  scope: MergedPredictedDockScope;
  existingRows: ExistingPredictedDockRow[];
  updatedAt: number;
}): PredictedDockScopeReconciliationPlan => {
  const { scope, existingRows, updatedAt } = args;
  const existingByComposite = new Map(
    existingRows.map((row) => [predictedDockCompositeKey(row), row])
  );
  const incomingIds = new Set(scope.RowsByComposite.keys());
  const incomingSourceKeys = buildIncomingSourceKeySet(
    scope.RowsByComposite.values()
  );
  const deletes: Array<Id<"eventsPredicted">> = [];

  for (const existing of existingRows) {
    if (!scope.TargetKeys.has(existing.Key)) {
      continue;
    }

    const id = predictedDockCompositeKey(existing);
    if (incomingIds.has(id)) {
      continue;
    }

    if (shouldPreserveOmittedPrediction(existing, incomingSourceKeys)) {
      continue;
    }

    deletes.push(existing._id);
    existingByComposite.delete(id);
  }

  const inserts: ConvexPredictedDockEvent[] = [];
  const replacements: PredictedDockScopeReconciliationPlan["replacements"] = [];

  for (const row of scope.RowsByComposite.values()) {
    if (!scope.TargetKeys.has(row.Key)) {
      continue;
    }

    const nextRow: ConvexPredictedDockEvent = {
      ...row,
      UpdatedAt: updatedAt,
    };
    const id = predictedDockCompositeKey(row);
    const existing = existingByComposite.get(id);

    if (!existing) {
      inserts.push(nextRow);
      continue;
    }

    if (predictedRowsEqual(existing, nextRow)) {
      continue;
    }

    replacements.push({
      existingId: existing._id,
      row: nextRow,
    });
  }

  return { inserts, replacements, deletes };
};

/**
 * Compares visible prediction fields while ignoring Convex metadata differences.
 *
 * Used to skip replaces when only UpdatedAt would change, reducing churn on hot vessels.
 *
 * @param left - Stored eventsPredicted document including system fields
 * @param right - Candidate row after applying updatedAt for persistence comparison
 * @returns True when every compared field matches between left and right
 */
const predictedRowsEqual = (
  left: ExistingPredictedDockRow,
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
 * Collects Key plus PredictionSource pairs from incoming rows for replacement detection.
 *
 * Supports shouldPreserveOmittedPrediction by tracking whether an at-sea row superseded
 * an at-dock prediction for the same boundary without carrying explicit delete rows.
 *
 * @param rows - Iterable of incoming write rows for the merged scope
 * @returns Set of predictedSourceKey strings representing active boundary sources
 */
const buildIncomingSourceKeySet = (
  rows: Iterable<ConvexPredictedDockWriteRow>
): Set<string> => {
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(predictedSourceKey(row));
  }
  return keys;
};

/**
 * Determines whether an omitted composite should survive this reconciliation pass.
 *
 * Depart-next ML rows remain when the batch did not include a replacement ML row for
 * the same boundary Key and PredictionSource, avoiding flicker while sparse payloads arrive.
 *
 * @param row - Existing database row missing from RowsByComposite for its composite
 * @param incomingSourceKeys - Keys produced from buildIncomingSourceKeySet for this merge
 * @returns True when deletion should be skipped for this row
 */
const shouldPreserveOmittedPrediction = (
  row: ExistingPredictedDockRow,
  incomingSourceKeys: Set<string>
): boolean =>
  row.PredictionSource === "ml" &&
  DEPART_NEXT_ML_PREDICTION_TYPES.includes(
    row.PredictionType as (typeof DEPART_NEXT_ML_PREDICTION_TYPES)[number]
  ) &&
  !incomingSourceKeys.has(predictedSourceKey(row));

/**
 * Builds the coarse replacement-family key shared by at-dock and at-sea predictions.
 *
 * @param row - Row supplying Key and PredictionSource columns
 * @returns Concatenated Key and PredictionSource string for set membership checks
 */
const predictedSourceKey = (row: {
  Key: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionSource}`;
