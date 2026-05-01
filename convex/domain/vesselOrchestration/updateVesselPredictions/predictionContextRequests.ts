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
import { predictionInputsFromTripUpdate } from "./predictionInputsFromTripUpdate";
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
  const { activeTrip, completedHandoff } =
    predictionInputsFromTripUpdate(tripUpdate);
  const candidateTrip = completedHandoff?.scheduleTrip ?? activeTrip;
  if (candidateTrip === undefined) {
    return null;
  }
  const modelTypes = predictionModelTypesForTrip(candidateTrip);
  if (modelTypes.length === 0) {
    return null;
  }
  const departing = candidateTrip.DepartingTerminalAbbrev;
  const arriving = candidateTrip.ArrivingTerminalAbbrev;
  if (departing === undefined || arriving === undefined) {
    return null;
  }
  return {
    pairKey: formatTerminalPairKey(departing, arriving),
    modelTypes,
  };
};
