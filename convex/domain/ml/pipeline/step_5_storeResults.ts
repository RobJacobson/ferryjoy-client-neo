// ============================================================================
// STEP 6: STORE RESULTS
// Simple database storage
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { PIPELINE_CONFIG } from "domain/ml/pipeline/shared/config";
import type { ModelParameters } from "domain/ml/types";

/**
 * Store model results
 */
export const storeModelResults = async (
  results: ModelParameters[],
  ctx: ActionCtx
): Promise<void> => {
  console.log(`Storing ${results.length} model results`);

  const savePromises = results.map((model) => storeSingleModel(model, ctx));

  const outcomes = await Promise.allSettled(savePromises);
  const successful = outcomes.filter((o) => o.status === "fulfilled").length;
  const failed = outcomes.filter((o) => o.status === "rejected").length;

  console.log(`Storage completed: ${successful} successful, ${failed} failed`);

  if (failed > 0) {
    console.warn(`Failed to store ${failed} models out of ${results.length}`);
  }
};

/**
 * Store a single model
 */
const storeSingleModel = async (
  model: ModelParameters,
  ctx: ActionCtx
): Promise<void> => {
  const pairKey = `${model.departingTerminalAbbrev}_${model.arrivingTerminalAbbrev}`;

  try {
    await ctx.runMutation(
      api.functions.predictions.mutations.storeModelParametersMutation,
      {
        model: {
          departingTerminalAbbrev: model.departingTerminalAbbrev,
          arrivingTerminalAbbrev: model.arrivingTerminalAbbrev,
          modelType: model.modelType,
          modelAlgorithm: PIPELINE_CONFIG.MODEL_ALGORITHM,

          // Optional model parameters
          coefficients: model.coefficients,
          intercept: model.intercept,
          trainingMetrics: model.trainingMetrics,

          // Required metadata
          createdAt: model.createdAt,

          // Bucket statistics (simplified)
          bucketStats: {
            totalRecords: model.bucketStats.totalRecords,
            filteredRecords: model.bucketStats.filteredRecords,
          },
        },
      }
    );

    console.log(`Stored ${model.modelType} model for ${pairKey}`);
  } catch (error) {
    console.error(
      `Failed to store ${model.modelType} model for ${pairKey}:`,
      error
    );
    throw error;
  }
};
