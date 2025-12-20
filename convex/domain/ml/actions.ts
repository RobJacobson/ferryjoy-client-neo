import { api } from "_generated/api";
import type { Id } from "_generated/dataModel";
import { type ActionCtx, internalAction } from "_generated/server";
import { runMLPipeline } from "domain/ml/pipeline/orchestrator";
import { predict } from "domain/ml/predict";
import type { PredictionOutput, TrainingResponse } from "domain/ml/types";
import { toDomainVesselTrip, vesselTripSchema } from "functions/vesselTrips";

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Trains prediction models for all terminal pairs using the new pipeline
 * Uses Convex database as data source (default)
 */
export const trainPredictionModelsAction = internalAction({
  args: {},
  handler: async (ctx): Promise<TrainingResponse> => {
    console.log("Starting ML training pipeline with Convex data source");
    return await runMLPipeline(ctx, "convex");
  },
});

/**
 * Trains prediction models using WSF API data as source
 * Fetches vessel histories from WSF backend for the configured date range
 */
export const trainPredictionModelsWSFAction = internalAction({
  args: {},
  handler: async (ctx): Promise<TrainingResponse> => {
    console.log("Starting ML training pipeline with WSF data source");
    return await runMLPipeline(ctx, "wsf");
  },
});

/**
 * Predicts departure and arrival durations for a vessel trip
 */
export const predictDurationsAction = internalAction({
  args: {
    trip: vesselTripSchema,
  },
  handler: async (ctx, args): Promise<PredictionOutput> => {
    // Convert from Convex format (numbers) to domain format (Dates)
    const domainTrip = toDomainVesselTrip(args.trip);
    return await predict(ctx, domainTrip);
  },
});

/**
 * Deletes all models from the database
 */
export const deleteAllModelsAction = internalAction({
  args: {},
  handler: async (ctx: ActionCtx) => {
    console.log("Starting deletion of all models");

    const models: Array<{ _id: Id<"modelParameters"> }> = await ctx.runQuery(
      api.functions.predictions.queries.getAllModelParameters
    );

    if (models.length === 0) {
      console.log("No models found to delete");
      return { deletedCount: 0 };
    }

    console.log(`Found ${models.length} models to delete`);

    const deletePromises = models.map((model) =>
      ctx.runMutation(
        api.functions.predictions.mutations.deleteModelParametersMutation,
        { modelId: model._id }
      )
    );

    await Promise.all(deletePromises);

    console.log(`Successfully deleted ${models.length} models`);
    return { deletedCount: models.length };
  },
});

// Feature extraction is now handled in the predict function
