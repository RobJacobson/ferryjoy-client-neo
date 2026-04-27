/**
 * Internal mutations for the orchestrator-owned hot write path.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { persistVesselPredictions } from "./persistence/predictionWrites";
import { persistVesselTimelineWrites } from "./persistence/timelineWrites";
import { persistVesselTripWrites } from "./persistence/tripWrites";
import { persistPerVesselOrchestratorWritesSchema } from "./schemas";

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
    try {
      // Persist trip lifecycle first so prediction/timeline writes see latest trip state.
      await persistVesselTripWrites(ctx, args.tripWrites);
      // Apply prediction proposals before timeline rows consume predicted values.
      await persistVesselPredictions(ctx, args.predictionRows);
      // Persist final timeline rows last because they are projection outputs.
      await persistVesselTimelineWrites(ctx, {
        actualEvents: args.actualEvents,
        predictedEvents: args.predictedEvents,
      });
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
