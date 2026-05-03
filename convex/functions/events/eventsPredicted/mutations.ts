/**
 * Writes to `eventsPredicted`: sparse batch upserts from trip/timeline code and
 * depart-next actualization when a departure boundary is observed.
 */

import type { Doc } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { DEPART_NEXT_ML_PREDICTION_TYPES } from "domain/events/predicted/departNextActualization";
import { predictedDockCompositeKey } from "domain/events/predicted/schemas";
import { buildVesselSailingDayScopeKey } from "shared/keys";
import { getRoundedMinutesDelta } from "shared/time";
import type {
  ConvexPredictedDockEvent,
  ConvexPredictedDockWriteRow,
} from "./schemas";

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
  // Merges inbound batches that share vessel/day into one scope before DB work.
  const batchesByScope = new Map<
    string,
    {
      VesselAbbrev: string;
      SailingDay: string;
      TargetKeys: Set<string>;
      RowsByComposite: Map<string, ConvexPredictedDockWriteRow>;
    }
  >();

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

    // Indexes stored rows by composite key so incoming rows resolve inserts vs replaces.
    const existingByComposite = new Map(
      existingRows.map((row) => [predictedDockCompositeKey(row), row])
    );

    const incomingIds = new Set(batch.RowsByComposite.keys());

    // Deletes rows missing from payload under TargetKeys unless ML depart-next guard skips delete.
    for (const existing of existingRows) {
      if (!batch.TargetKeys.has(existing.Key)) {
        continue;
      }
      const id = predictedDockCompositeKey(existing);
      if (!incomingIds.has(id)) {
        if (shouldPreserveDepartNextMlRow(existing)) {
          continue;
        }
        await ctx.db.delete(existing._id);
        existingByComposite.delete(id);
      }
    }

    // Upserts each incoming row under TargetKeys using shared UpdatedAt and equality skips.
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
};

/**
 * Returns whether a stored prediction matches the candidate replacement row.
 *
 * Ignores Convex metadata; skips redundant replaces when ML/ETA fields match.
 *
 * @param left - Document already in `eventsPredicted`
 * @param right - Candidate row including `UpdatedAt`
 * @returns `true` when storage should stay unchanged
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
 * Returns whether sparse-batch deletion must skip this depart-next ML row.
 *
 * Incomplete batches omit rows; guard prevents wiping predictions still in flight.
 *
 * @param row - Existing `eventsPredicted` document
 * @returns `true` when this row must not be deleted for omission alone
 */
const shouldPreserveDepartNextMlRow = (row: Doc<"eventsPredicted">): boolean =>
  row.PredictionSource === "ml" &&
  DEPART_NEXT_ML_PREDICTION_TYPES.includes(
    row.PredictionType as (typeof DEPART_NEXT_ML_PREDICTION_TYPES)[number]
  );

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
