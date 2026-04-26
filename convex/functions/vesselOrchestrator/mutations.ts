/**
 * Internal mutation for the orchestrator-owned hot write path.
 *
 * This collapses per-ping writes into one functions-owned entrypoint so the
 * action computes plain-data outputs and hands off one persistence bundle.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { persistVesselPredictions } from "./persistVesselPredictions";
import { persistVesselTimelineWrites } from "./persistVesselTimeline";
import { persistTripWritesForVessel } from "./persistVesselTrips";
import { persistPerVesselOrchestratorWritesSchema } from "./schemas";

export const persistPerVesselOrchestratorWrites = internalMutation({
  args: persistPerVesselOrchestratorWritesSchema,
  returns: v.null(),
  handler: async (ctx, args) => {
    const tripPersistResult = await persistTripWritesForVessel(
      ctx,
      args.tripWrite
    );
    await persistVesselPredictions(ctx, args.predictionRows);
    await persistVesselTimelineWrites(ctx, {
      pingStartedAt: args.pingStartedAt,
      tripHandoffForTimeline: {
        completedFacts: tripPersistResult.completedFacts,
        currentBranch: {
          successfulVessels: tripPersistResult.currentBranch.successfulVessels,
          pendingActualMessages:
            tripPersistResult.currentBranch.pendingActualMessages,
          pendingPredictedMessages:
            tripPersistResult.currentBranch.pendingPredictedMessages,
        },
      },
      mlTimelineOverlays: args.mlTimelineOverlays,
    });

    return null;
  },
});
