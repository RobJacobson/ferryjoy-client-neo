/**
 * Derive the model-load request for the predictions context preload.
 *
 * Lives in the predictions domain so callers (action layer) only need to
 * forward the resulting requests to their Convex query — no derivation logic
 * leaks into orchestrator action code.
 */

import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import {
  buildPredictionStagePlan,
  type PredictionModelLoadRequest,
} from "./predictionStagePlan";

export type { PredictionModelLoadRequest } from "./predictionStagePlan";

/**
 * Builds the terminal-pair model-load request for one ping branch, if any.
 *
 * `null` when the trip update has no candidate trip or the candidate yields
 * no applicable model types for its phase.
 *
 * @param tripUpdate - Sparse trip update rows for this ping branch
 * @returns Single preload request for the derived pair, or `null` to skip
 */
export const predictionModelLoadRequestForTripUpdate = (
  tripUpdate: VesselTripUpdate
): PredictionModelLoadRequest | null =>
  buildPredictionStagePlan(tripUpdate).modelLoadRequest;
