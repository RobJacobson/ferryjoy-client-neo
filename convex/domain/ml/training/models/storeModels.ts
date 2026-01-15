// ============================================================================
// ML - MODEL STORAGE
// Stores models into modelParameters table
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ModelParameters } from "../../shared/types";

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
  };
};

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
