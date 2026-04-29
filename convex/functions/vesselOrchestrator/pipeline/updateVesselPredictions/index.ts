/**
 * Stage-level loaders and persistence helpers for update-vessel-predictions.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import {
  predictionModelLoadRequestsForTripUpdate,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";

export { persistPredictionRows } from "./persist";

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
