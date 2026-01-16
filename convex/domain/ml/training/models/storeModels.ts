// ============================================================================
// MODEL STORAGE UTILITIES
// Persists trained ML models to Convex database for production inference
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ModelParameters } from "../../shared/types";

/**
 * Convert ML domain model parameters to Convex database format.
 *
 * Transforms internal model representation to database-compatible schema
 * while maintaining all training metadata and performance metrics.
 * New models are saved as dev-temp (versionType: "dev", versionNumber: -1).
 *
 * @param model - Trained model parameters from ML pipeline
 * @returns Convex-compatible model document
 */
const toConvexModel = (model: ModelParameters) => {
  return {
    bucketType: "pair" as const,
    pairKey: model.bucketKey.pairKey,
    modelType: model.modelType,
    featureKeys: model.featureKeys,
    coefficients: model.coefficients,
    intercept: model.intercept,
    testMetrics: model.testMetrics,
    createdAt: model.createdAt,
    bucketStats: model.bucketStats,
    versionType: "dev" as const,
    versionNumber: -1, // dev-temp
  };
};

/**
 * Store trained ML models in Convex database.
 *
 * Persists model parameters for production inference while maintaining
 * proper indexing for efficient retrieval during prediction. Uses parallel
 * storage to optimize deployment time.
 *
 * @param models - Array of successfully trained model parameters
 * @param ctx - Convex action context for database operations
 */
export const storeModels = async (
  models: ModelParameters[],
  ctx: ActionCtx
): Promise<void> => {
  const storePromises = models.map((model) =>
    ctx.runMutation(
      api.functions.predictions.mutations.storeModelParametersMutation,
      { model: toConvexModel(model) }
    )
  );

  await Promise.all(storePromises);
};
