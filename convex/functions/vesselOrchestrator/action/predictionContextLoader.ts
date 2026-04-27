/**
 * Action-level loader for the prediction model context preload.
 *
 * Survives at the action layer because it issues a Convex query; the pure
 * derivation of which model load requests to issue lives in the predictions
 * domain.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import {
  predictionModelLoadRequestsForTripUpdate,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";

/**
 * Loads production prediction context for the current ping branch.
 *
 * @param ctx - Convex action context used for the model parameter query
 * @param tripUpdate - Sparse trip update rows for this ping branch
 * @returns Prediction context keyed by terminal pair, or empty context
 */
export const loadPredictionContext = async (
  ctx: ActionCtx,
  tripUpdate: VesselTripUpdate
): Promise<VesselPredictionContext> => {
  const requests = predictionModelLoadRequestsForTripUpdate(tripUpdate);
  if (requests.length === 0) {
    return {};
  }
  const productionModelsByPair = await ctx.runQuery(
    internal.functions.predictions.queries.getProductionModelParametersForPing,
    { requests }
  );
  return { productionModelsByPair };
};
