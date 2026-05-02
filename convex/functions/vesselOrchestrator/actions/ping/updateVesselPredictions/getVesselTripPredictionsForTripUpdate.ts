/**
 * Orchestrator helper: runs **`getVesselTripPredictionsFromTripUpdate`** for a
 * **`VesselTripUpdate`**, with prediction-parameter reads supplied by
 * **`loadPredictionModelParameters`**.
 */

import type { ActionCtx } from "_generated/server";
import { getVesselTripPredictionsFromTripUpdate } from "domain/vesselOrchestration/updateVesselPredictions";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import { loadPredictionModelParameters } from "./load";

/**
 * @param ctx - Convex action context used for the internal parameter query
 * @param tripUpdate - Sparse trip rows from **`updateVesselTrip`** for this branch
 */
export const getVesselTripPredictionsForTripUpdate = async (
  ctx: ActionCtx,
  tripUpdate: VesselTripUpdate
) =>
  getVesselTripPredictionsFromTripUpdate(tripUpdate, {
    loadPredictionModelParameters: (request) =>
      loadPredictionModelParameters(ctx, request),
  });
