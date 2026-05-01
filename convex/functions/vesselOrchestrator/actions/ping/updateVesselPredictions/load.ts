/**
 * Stage-level loaders for update-vessel-predictions.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import {
  predictionModelLoadRequestForTripUpdate,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";

/**
 * Loads production prediction context for the current ping branch.
 *
 * When domain **`predictionModelLoadRequestForTripUpdate`** returns null, skips
 * the Convex query entirely. Otherwise loads model parameters keyed by terminal
 * pair for **`updateVesselPredictions`** in the same action branch.
 *
 * @param ctx - Convex action context used for the model parameter query
 * @param tripUpdate - Sparse trip update rows for this ping branch
 * @returns Prediction context keyed by terminal pair, or empty context
 */
export const loadPredictionContext = async (
  ctx: ActionCtx,
  tripUpdate: VesselTripUpdate
): Promise<VesselPredictionContext> => {
  const request = predictionModelLoadRequestForTripUpdate(tripUpdate);
  if (request === null) {
    return {};
  }
  const productionModelsByPair = await ctx.runQuery(
    internal.functions.predictions.queries.getProductionModelParametersForPing,
    { request }
  );
  return { productionModelsByPair };
};
