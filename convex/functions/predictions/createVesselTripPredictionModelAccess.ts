/**
 * Convex action implementation of {@link VesselTripPredictionModelAccess}
 * for vessel orchestrator ticks (forwards to production model queries).
 */

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type {
  ProductionModelParameters,
  VesselTripPredictionModelAccess,
} from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";

/**
 * Builds a prediction model access object that uses this action's
 * `runQuery` with the same prediction queries as legacy `predictTrip` wiring.
 *
 * @param ctx - Convex action context
 * @returns Port for domain vessel-trip prediction reads
 */
export const createVesselTripPredictionModelAccess = (
  ctx: ActionCtx
): VesselTripPredictionModelAccess => ({
  loadModelForProductionPair: async (pairKey, modelType) => {
    const doc = await ctx.runQuery(
      api.functions.predictions.queries.getModelParametersForProduction,
      { pairKey, modelType }
    );
    return doc as ProductionModelParameters | null;
  },

  loadModelsForProductionPairBatch: async (pairKey, modelTypes) => {
    if (modelTypes.length === 0) {
      return {} as Record<ModelType, ProductionModelParameters | null>;
    }
    const batch = await ctx.runQuery(
      api.functions.predictions.queries.getModelParametersForProductionBatch,
      { pairKey, modelTypes }
    );
    return batch as Record<ModelType, ProductionModelParameters | null>;
  },
});
