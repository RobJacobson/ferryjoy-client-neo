/**
 * Orchestrator helper: runs `getVesselTripPredictionsFromTripUpdate` for a
 * `VesselTripUpdate`, with prediction-parameter reads supplied by
 * `loadPredictionModelParameters`.
 */

import type { ActionCtx } from "_generated/server";
import { getVesselTripPredictionsFromTripUpdate } from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import { loadPredictionModelParameters } from "./load";

/**
 * Runs the prediction domain entry with Convex-backed model-parameter loads.
 *
 * Supplies `loadPredictionModelParameters` so
 * `getVesselTripPredictionsFromTripUpdate` can stay testable while the
 * orchestrator uses `ctx.runQuery` for `getPredictionModelParameters`.
 *
 * @param ctx - Convex action context used for the internal parameter query
 * @param tripUpdate - Sparse trip rows from `updateVesselTrip` for this branch
 * @returns Prediction proposal rows and enriched active trip for timeline and
 *   `persistVesselUpdates`
 */
export const getVesselTripPredictionsForTripUpdate = async (
  ctx: ActionCtx,
  tripUpdate: VesselTripUpdate
) =>
  getVesselTripPredictionsFromTripUpdate(tripUpdate, {
    loadPredictionModelParameters: (request) =>
      loadPredictionModelParameters(ctx, request),
  });
