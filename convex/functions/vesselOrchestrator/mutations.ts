/**
 * Internal mutation for the orchestrator-owned hot write path.
 *
 * This collapses per-ping writes into one functions-owned entrypoint so the
 * action computes plain-data outputs and hands off one persistence bundle.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { upsertActualDockRows } from "functions/events/eventsActual/mutations";
import { projectPredictedDockWriteBatchesInDb } from "functions/events/eventsPredicted/mutations";
import { batchUpsertProposalsInDb } from "functions/vesselTripPredictions/mutations";
import {
  persistVesselTripWrites,
  type VesselTripWrites,
} from "./persistVesselTripWriteSet";
import {
  persistTimelineEventWritesSchema,
  persistTripAndPredictionWritesSchema,
  persistedTripTimelineHandoffSchema,
} from "./schemas";

export const persistTripAndPredictionWrites = internalMutation({
  args: persistTripAndPredictionWritesSchema,
  returns: persistedTripTimelineHandoffSchema,
  handler: async (ctx, args) => {
    const tripWrites: VesselTripWrites = {
      ...args.tripWrites,
      predictedDockWrites: args.tripWrites.predictedDockWrites.map((write) => ({
        ...write,
        existingTrip: write.existingTrip,
      })),
    };
    const tripPersistResult = await persistVesselTripWrites(ctx, tripWrites);

    if (args.predictionRows.length > 0) {
      await batchUpsertProposalsInDb(ctx, args.predictionRows);
    }

    return {
      completedFacts: tripPersistResult.completedFacts,
      currentBranch: {
        successfulVessels: [...tripPersistResult.currentBranch.successfulVessels],
        pendingActualMessages: tripPersistResult.currentBranch.pendingActualMessages,
        pendingPredictedMessages:
          tripPersistResult.currentBranch.pendingPredictedMessages,
      },
    };
  },
});

export const persistTimelineEventWrites = internalMutation({
  args: persistTimelineEventWritesSchema,
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.actualEvents.length > 0) {
      await upsertActualDockRows(ctx, args.actualEvents);
    }

    if (args.predictedEvents.length > 0) {
      await projectPredictedDockWriteBatchesInDb(ctx, args.predictedEvents);
    }

    return null;
  },
});
