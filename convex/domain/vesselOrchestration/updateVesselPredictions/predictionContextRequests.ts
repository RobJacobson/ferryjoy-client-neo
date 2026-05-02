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
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { modelTypesForTripPhase } from "./predictionPolicy";

/**
 * Arguments for loading production model parameters for one terminal pair
 * (`getProductionModelParametersForPing`).
 */
export type PredictionPreloadRequest = {
  pairKey: string;
  modelTypes: Array<ModelType>;
};

/**
 * Builds the preload payload for production model parameters from a ping's
 * trip update, if the active trip has a route and at least one phase model.
 *
 * @param tripUpdate - Sparse trip update rows for this ping branch
 * @returns Pair key + model types for the query, or `null` to skip loading
 */
export const predictionPreloadFromVesselTripUpdate = (
  tripUpdate: VesselTripUpdate
): PredictionPreloadRequest | null => {
  const active = tripUpdate.activeVesselTrip;
  const pairKey = terminalPairKeyForPredictionPreload(active);
  const modelTypes = modelTypesForTripPhase(active);
  if (pairKey === null || modelTypes.length === 0) {
    return null;
  }
  return { pairKey, modelTypes };
};

/**
 * Canonical terminal-pair string when both endpoints exist on the trip row.
 *
 * @param active - Active vessel trip row carrying departing/arriving abbrevs
 * @returns Canonical pair string, or `null` when the route is incomplete
 */
const terminalPairKeyForPredictionPreload = (
  active: ConvexVesselTrip
): string | null => {
  const departing = active.DepartingTerminalAbbrev;
  const arriving = active.ArrivingTerminalAbbrev;
  if (departing === undefined || arriving === undefined) {
    return null;
  }
  return formatTerminalPairKey(departing, arriving);
};
