/**
 * Pure reconciliation planning for `eventsPredicted` sparse write batches.
 *
 * The Convex mutation owns reads and writes; this module owns the business
 * policy for merging batches, deleting stale rows, preserving in-flight
 * depart-next predictions, and deciding insert vs replace.
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
 * Merges incoming predicted-event write batches by vessel/sailing-day scope.
 *
 * @param batches - Sparse write batches produced by timeline projection
 * @returns One merged scope per vessel/day, keyed by stable scope string
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
 * Plans delete / insert / replace operations for one predicted-event scope.
 *
 * Omitted rows under `TargetKeys` are deleted unless they are in-flight
 * depart-next ML rows with no same-boundary ML replacement. This preserves
 * incomplete sparse batches while still allowing at-sea rows to supersede
 * older at-dock rows for the same boundary.
 *
 * @param args.scope - Merged vessel/day write scope
 * @param args.existingRows - Current DB rows for that vessel/day
 * @param args.updatedAt - Shared write timestamp for inserted/replaced rows
 * @returns Exact persistence operations to apply
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
 * Returns whether two predicted rows match for persistence purposes.
 *
 * @param left - Existing stored row
 * @param right - Candidate row including `UpdatedAt`
 * @returns Whether replacing would be a no-op
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
 * Builds source-level replacement keys (`Key` + `PredictionSource`).
 *
 * @param rows - Incoming rows for a merged scope
 * @returns Set used to detect at-sea replacements for older at-dock rows
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
 * Returns whether a missing incoming row should survive sparse reconciliation.
 *
 * @param row - Existing stored row omitted from the incoming payload
 * @param incomingSourceKeys - Incoming boundary/source replacement keys
 * @returns Whether omission alone should not delete this row
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
 * Groups predictions by boundary and source, ignoring phase-specific type.
 *
 * @param row - Prediction row-like object
 * @returns Key used to identify at-dock/at-sea replacement families
 */
const predictedSourceKey = (row: {
  Key: string;
  PredictionSource: string;
}): string => `${row.Key}|${row.PredictionSource}`;
