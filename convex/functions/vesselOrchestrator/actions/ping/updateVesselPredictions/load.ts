/**
 * Convex query adapter for loading prediction model parameters used by
 * `getVesselTripPredictionsFromTripUpdate`.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type {
  PredictionModelParametersByPairKey,
  PredictionModelParametersRequest,
} from "domain/vesselOrchestration/updateVesselPredictions";

/**
 * Loads prediction model parameter documents for one orchestrator branch via
 * `getPredictionModelParameters`.
 *
 * @param ctx - Convex action context used for the internal query
 * @param request - Terminal pair and model types aligned with the domain
 *   request from `getPredictionModelParametersFromTripUpdate`
 * @returns Plain lookup keyed by pair string and model type, suitable for
 *   `applyVesselPredictionsFromLoadedModels`
 */
export const loadPredictionModelParameters = async (
  ctx: ActionCtx,
  request: PredictionModelParametersRequest
): Promise<PredictionModelParametersByPairKey> =>
  ctx.runQuery(
    internal.functions.predictions.queries.getPredictionModelParameters,
    { request }
  );
