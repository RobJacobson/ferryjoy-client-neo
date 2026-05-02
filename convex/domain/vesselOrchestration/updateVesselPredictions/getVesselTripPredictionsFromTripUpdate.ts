/**
 * Derives vessel-trip prediction proposal rows and an enriched active trip from
 * a trip update and optionally loaded prediction model parameters.
 */

import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import { applyVesselPredictionsFromLoadedModels } from "./applyVesselPredictions";
import { getPredictionModelParametersFromTripUpdate } from "./getPredictionModelParametersFromTripUpdate";
import type {
  PredictionModelParametersByPairKey,
  PredictionModelParametersRequest,
  VesselTripPredictionDeps,
  VesselTripPredictionsFromTripUpdateResult,
} from "./types";
import { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";

/**
 * Loads prediction parameters when needed, enriches the active trip with
 * phase-valid predictions, and returns persistence proposals plus the same
 * enriched active trip used by timeline assembly.
 *
 * @param tripUpdate - Sparse trip rows from `updateVesselTrip` for this branch
 * @param deps - Async loader for **`getPredictionModelParameters`** query results
 * @returns Prediction table rows and enriched active trip
 */
export const getVesselTripPredictionsFromTripUpdate = async (
  tripUpdate: VesselTripUpdate,
  deps: VesselTripPredictionDeps
): Promise<VesselTripPredictionsFromTripUpdateResult> => {
  const activeTrip = tripUpdate.activeVesselTrip;
  const request = getPredictionModelParametersFromTripUpdate(tripUpdate);
  const predictionModelParametersByPairKey =
    request === null
      ? undefined
      : await loadPredictionModelParametersForTripUpdate(
          tripUpdate,
          request,
          deps
        );

  const enrichedActiveVesselTrip = await applyVesselPredictionsFromLoadedModels(
    predictionModelParametersByPairKey,
    activeTrip
  );

  const predictionRows =
    vesselTripPredictionProposalsFromMlTrip(enrichedActiveVesselTrip);

  return {
    enrichedActiveVesselTrip,
    predictionRows,
  };
};

const loadPredictionModelParametersForTripUpdate = async (
  tripUpdate: VesselTripUpdate,
  request: PredictionModelParametersRequest,
  deps: VesselTripPredictionDeps
): Promise<PredictionModelParametersByPairKey | undefined> => {
  try {
    return await deps.loadPredictionModelParameters(request);
  } catch (error) {
    console.error("[Prediction] Failed to load model parameters", {
      vesselAbbrev: tripUpdate.vesselAbbrev,
      request,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
};
