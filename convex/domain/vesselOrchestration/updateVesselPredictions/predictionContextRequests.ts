/**
 * Derive the model-load request for the predictions context preload.
 *
 * Lives in the predictions domain so callers (action layer) only need to
 * forward the resulting requests to their Convex query — no derivation logic
 * leaks into orchestrator action code.
 */

import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import { predictionModelTypesForTrip } from "./predictionPolicy";

export type PredictionModelLoadRequest = {
  pairKey: string;
  modelTypes: Array<ModelType>;
};

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
): PredictionModelLoadRequest | null => {
  const active = tripUpdate.activeVesselTrip;
  const modelTypes = predictionModelTypesForTrip(active);
  const departing = active.DepartingTerminalAbbrev;
  const arriving = active.ArrivingTerminalAbbrev;
  if (
    modelTypes.length === 0 ||
    departing === undefined ||
    arriving === undefined
  ) {
    return null;
  }
  return {
    pairKey: formatTerminalPairKey(departing, arriving),
    modelTypes,
  };
};
