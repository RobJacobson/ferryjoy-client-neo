import { api } from "_generated/api";
import type { Id } from "_generated/dataModel";
import { type ActionCtx, internalAction } from "_generated/server";
import { runMLPipeline } from "domain/ml/pipelineCoordinator";
import type {
  TrainingResponse,
} from "domain/ml/types";

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Trains prediction models for all terminal pairs using the ML pipeline
 */
export const trainPredictionModelsAction = internalAction({
  args: {},
  handler: async (ctx): Promise<TrainingResponse> => {
    console.log("Starting ML training pipeline with WSF data source");
    return await runMLPipeline(ctx);
  },
});

/**
 * Deletes all models from database
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

// Feature extraction is now handled in predict function
