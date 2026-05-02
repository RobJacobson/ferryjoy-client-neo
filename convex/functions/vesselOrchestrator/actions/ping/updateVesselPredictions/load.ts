/**
 * Stage-level loaders for update-vessel-predictions.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type {
  PredictionPreloadRequest,
  VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";

/**
 * Loads production prediction context for the current ping branch.
 *
 * When the stage plan has no model-load request, skips the Convex query
 * entirely. Otherwise loads model parameters keyed by terminal pair for
 * **`updateVesselPredictions`** in the same action branch.
 *
 * @param ctx - Convex action context used for the model parameter query
 * @param request - Terminal pair + model types for this ping branch, if any
 * @returns Prediction context keyed by terminal pair, or empty context
 */
export const loadPredictionContext = async (
  ctx: ActionCtx,
  request: PredictionPreloadRequest | null | undefined
): Promise<VesselPredictionContext> => {
  if (request === null || request === undefined) {
    return {};
  }
  const productionModelsByPair = await ctx.runQuery(
    internal.functions.predictions.queries.getProductionModelParametersForPing,
    { request }
  );
  return { productionModelsByPair };
};
