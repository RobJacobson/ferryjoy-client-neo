/**
 * Internal mutations for the orchestrator-owned hot write path.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { fetchEntryByKey, upsertByKey } from "functions/keyValueStore/helpers";
import { persistVesselPredictions } from "./persistence/predictionWrites";
import { persistVesselTimelineWrites } from "./persistence/timelineWrites";
import { persistVesselTripWrites } from "./persistence/tripWrites";
import { persistPerVesselOrchestratorWritesSchema } from "./schemas";

type MinutePersistenceTotals = {
  calls: number;
  tripWriteIntentCount: number;
  predictionRowCount: number;
  actualEventRowCount: number;
  predictedEventRowCount: number;
};

const EMPTY_MINUTE_TOTALS: MinutePersistenceTotals = {
  calls: 0,
  tripWriteIntentCount: 0,
  predictionRowCount: 0,
  actualEventRowCount: 0,
  predictedEventRowCount: 0,
};

const ORCHESTRATOR_PERSIST_MINUTE_KEY_PREFIX =
  "debug:vesselOrchestrator:persistPerVesselOrchestratorWrites:minute:";
const ORCHESTRATOR_PERSIST_LAST_LOGGED_MINUTE_KEY =
  "debug:vesselOrchestrator:persistPerVesselOrchestratorWrites:lastLoggedMinute";

const minuteKeyFromEpochMs = (epochMs: number): string =>
  new Date(epochMs).toISOString().slice(0, 16);

const parseMinuteTotals = (value: string | null): MinutePersistenceTotals => {
  if (value === null) {
    return { ...EMPTY_MINUTE_TOTALS };
  }
  try {
    const parsed = JSON.parse(value) as Partial<MinutePersistenceTotals>;
    return {
      calls: parsed.calls ?? 0,
      tripWriteIntentCount: parsed.tripWriteIntentCount ?? 0,
      predictionRowCount: parsed.predictionRowCount ?? 0,
      actualEventRowCount: parsed.actualEventRowCount ?? 0,
      predictedEventRowCount: parsed.predictedEventRowCount ?? 0,
    };
  } catch {
    return { ...EMPTY_MINUTE_TOTALS };
  }
};

const updateMinutePersistenceTotals = async (
  ctx: MutationCtx,
  minute: string,
  increment: MinutePersistenceTotals
): Promise<void> => {
  const key = `${ORCHESTRATOR_PERSIST_MINUTE_KEY_PREFIX}${minute}`;
  const existing = await fetchEntryByKey(ctx, key);
  const current = parseMinuteTotals(
    typeof existing?.value === "string" ? existing.value : null
  );
  const next: MinutePersistenceTotals = {
    calls: current.calls + increment.calls,
    tripWriteIntentCount:
      current.tripWriteIntentCount + increment.tripWriteIntentCount,
    predictionRowCount:
      current.predictionRowCount + increment.predictionRowCount,
    actualEventRowCount:
      current.actualEventRowCount + increment.actualEventRowCount,
    predictedEventRowCount:
      current.predictedEventRowCount + increment.predictedEventRowCount,
  };
  await upsertByKey(ctx, key, JSON.stringify(next));
};

/** Explicit numeric fields so logs always include zeros (temporary debug telemetry). */
const minuteTotalsForLog = (totals: MinutePersistenceTotals): MinutePersistenceTotals => ({
  calls: totals.calls,
  tripWriteIntentCount: totals.tripWriteIntentCount,
  predictionRowCount: totals.predictionRowCount,
  actualEventRowCount: totals.actualEventRowCount,
  predictedEventRowCount: totals.predictedEventRowCount,
});

const maybeLogCurrentMinuteTotals = async (
  ctx: MutationCtx,
  minute: string
): Promise<void> => {
  const lastLoggedMinuteEntry = await fetchEntryByKey(
    ctx,
    ORCHESTRATOR_PERSIST_LAST_LOGGED_MINUTE_KEY
  );
  const lastLoggedMinute =
    typeof lastLoggedMinuteEntry?.value === "string"
      ? lastLoggedMinuteEntry.value
      : null;
  if (lastLoggedMinute === minute) {
    return;
  }

  const totalsEntry = await fetchEntryByKey(
    ctx,
    `${ORCHESTRATOR_PERSIST_MINUTE_KEY_PREFIX}${minute}`
  );
  const totals = minuteTotalsForLog(
    parseMinuteTotals(
      typeof totalsEntry?.value === "string" ? totalsEntry.value : null
    )
  );
  console.log("[persistPerVesselOrchestratorWrites] minute write totals", {
    minute,
    ...totals,
  });
  await upsertByKey(ctx, ORCHESTRATOR_PERSIST_LAST_LOGGED_MINUTE_KEY, minute);
};

/**
 * Persists trip, prediction, and timeline rows for one vessel pipeline branch.
 *
 * This mutation is the write boundary for orchestrator per-vessel persistence.
 * It exists so action-side compute can remain pure(ish) and precompute rows in
 * memory, while mutation code applies writes in a deterministic order. The
 * ordering reflects data dependencies across modules: trip lifecycle first,
 * then prediction proposals, then timeline projection rows. Wrapping all three
 * phases here keeps write semantics centralized and easier to reason about.
 *
 * @param ctx - Convex mutation context used for all write operations
 * @param args - Precomputed sparse writes produced in action memory
 * @returns `null` after all write phases apply successfully
 */
export const persistPerVesselOrchestratorWrites = internalMutation({
  args: persistPerVesselOrchestratorWritesSchema,
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentMinuteKey = minuteKeyFromEpochMs(Date.now());
    try {
      const tripWriteIntentCount =
        Number(args.completedVesselTrip !== undefined) +
        Number(args.activeVesselTrip !== undefined);

      // Persist trip lifecycle first so prediction/timeline writes see latest trip state.
      await persistVesselTripWrites(ctx, {
        vesselAbbrev: args.vesselAbbrev,
        existingActiveTrip: args.existingActiveTrip,
        activeVesselTrip: args.activeVesselTrip,
        completedVesselTrip: args.completedVesselTrip,
      });
      // Apply prediction proposals before timeline rows consume predicted values.
      await persistVesselPredictions(ctx, args.predictionRows);
      // Persist final timeline rows last because they are projection outputs.
      await persistVesselTimelineWrites(ctx, {
        actualEvents: args.actualEvents,
        predictedEvents: args.predictedEvents,
      });
      await updateMinutePersistenceTotals(ctx, currentMinuteKey, {
        calls: 1,
        tripWriteIntentCount,
        predictionRowCount: args.predictionRows.length,
        actualEventRowCount: args.actualEvents.length,
        predictedEventRowCount: args.predictedEvents.length,
      });
      await maybeLogCurrentMinuteTotals(ctx, currentMinuteKey);
      return null;
    } catch (error) {
      // Wrap lower-level failures with mutation identity for clearer orchestrator logs.
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[persistPerVesselOrchestratorWrites] persistence failed: ${message}`
      );
    }
  },
});
