import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ActionCtx } from "@convex/_generated/server";
import { internalAction } from "@convex/_generated/server";
import { v } from "convex/values";

import { log } from "@/shared/lib/logger";

import { activeVesselTripSchema } from "../../functions/activeVesselTrips";
import { predict } from "./predict";
import { trainModels } from "./train";
import type { PredictionOutput, TrainingResponse } from "./types";

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Trains prediction models for all routes
 */
export const trainPredictionModelsAction = internalAction({
  args: {},
  handler: async (ctx): Promise<TrainingResponse> => {
    log.info("Starting prediction model training");
    return await trainModels(ctx);
  },
});

/**
 * Predicts departure time for a vessel trip pair
 */
export const predictTimeAction = internalAction({
  args: {
    prevTrip: activeVesselTripSchema,
    currTrip: activeVesselTripSchema,
  },
  handler: async (ctx, args): Promise<PredictionOutput> => {
    // Extract features from the vessel trips
    const features = extractFeatures(args.prevTrip, args.currTrip);
    const routeId = args.currTrip.OpRouteAbbrev || "unknown";

    return await predict(ctx, features, routeId);
  },
});

/**
 * Deletes all models from the database
 */
export const deleteAllModelsAction = internalAction({
  args: {},
  handler: async (ctx: ActionCtx) => {
    log.info("Starting deletion of all models");

    const models: Array<{ _id: Id<"modelParameters"> }> = await ctx.runQuery(
      api.functions.predictions.queries.getAllModelParameters
    );

    if (models.length === 0) {
      log.info("No models found to delete");
      return { deletedCount: 0 };
    }

    log.info(`Found ${models.length} models to delete`);

    const deletePromises = models.map((model) =>
      ctx.runMutation(
        api.functions.predictions.mutations.deleteModelParametersMutation,
        { modelId: model._id }
      )
    );

    await Promise.all(deletePromises);

    log.info(`Successfully deleted ${models.length} models`);
    return { deletedCount: models.length };
  },
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extracts features from vessel trip pair for prediction
 */
const extractFeatures = (_prevTrip: any, _currTrip: any) => {
  // Simplified feature extraction - should match training features
  return {
    "hourOfDay.00": 0, // TODO: Extract actual hour
    "terminal.SEA": 1, // TODO: Extract actual terminal
    "timestamp.currDepTimeSched": 0, // TODO: Extract actual timestamp
  };
};
