/**
 * Internal mutations for the orchestrator-owned hot write path.
 *
 * Actions/domain compute final write rows; these handlers only apply them.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { persistVesselPredictions } from "./persistVesselPredictions";
import { persistVesselTimelineWrites } from "./persistVesselTimeline";
import { persistVesselTripWrites } from "./persistVesselTripWriteSet";
import { persistPerVesselOrchestratorWritesSchema } from "./schemas";

export const persistPerVesselOrchestratorWrites = internalMutation({
  args: persistPerVesselOrchestratorWritesSchema,
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await persistVesselTripWrites(ctx, args.tripWrites);
      await persistVesselPredictions(ctx, args.predictionRows);
      await persistVesselTimelineWrites(ctx, {
        actualEvents: args.actualEvents,
        predictedEvents: args.predictedEvents,
      });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[persistPerVesselOrchestratorWrites] persistence failed: ${message}`
      );
    }
  },
});
