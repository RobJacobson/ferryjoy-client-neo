"use node";

import { api } from "_generated/api";
import type { Id } from "_generated/dataModel";
import { type ActionCtx, internalAction } from "_generated/server";
import { runMLPipeline } from "domain/ml/pipelineCoordinator";
import type { TrainingResponse } from "domain/ml/types";

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Trains prediction models for all terminal pairs using the complete ML pipeline
 *
 * This action orchestrates the entire machine learning pipeline:
 * 1. Loads WSF vessel history data
 * 2. Converts raw data to training records with feature engineering
 * 3. Groups records by terminal pairs and applies sampling
 * 4. Trains linear regression models for each terminal pair and model type
 * 5. Stores trained models in the database
 *
 * @param ctx - Convex internal action context
 * @returns Training response with statistics and data quality metrics
 */
export const trainPredictionModelsAction = internalAction({
  args: {},
  handler: async (ctx): Promise<TrainingResponse> => {
    console.log("Starting ML training pipeline with WSF data source");
    return await runMLPipeline(ctx);
  },
});

/**
 * Deletes all trained models from the database
 *
 * This action removes all model parameters from the modelParameters table.
 * Use with caution as this will affect all predictions until new models are trained.
 *
 * @param ctx - Convex action context
 * @returns Object containing the count of deleted models
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

    // Delete all models in parallel for efficiency
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
