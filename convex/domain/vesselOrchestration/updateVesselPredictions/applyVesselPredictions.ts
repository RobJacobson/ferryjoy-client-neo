/**
 * Applies phase-valid predictions from loaded prediction model parameters and
 * actualizes leave-dock prediction fields when an actual departure exists.
 *
 * Callers should invoke this with schedule/lifecycle trip rows from
 * **`updateVesselTrip`** (schedule-enriched `ConvexVesselTrip`). Canonical
 * prediction logic lives in {@link ./appendPredictions}; routing by physical
 * dock vs underway branch uses {@link ./tripDockStatePredictionSpecs}.
 */

import { actualizePredictionsOnLeaveDock } from "domain/ml/prediction";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { appendPredictionsFromLoadedModels } from "./appendPredictions";
import type { PredictionModelParametersByPairKey } from "./types";
import { getRunnablePredictionSpecsFromTrip } from "./tripDockStatePredictionSpecs";

/**
 * Applies loaded-model predictions for the trip's current phase, then
 * actualizes on leave-dock when applicable.
 *
 * @param predictionModelParametersByPairKey - Parameters keyed by terminal pair
 *   from **`getPredictionModelParameters`**, or `undefined` when no load ran
 * @param coreTrip - Schedule-enriched **`ConvexVesselTrip`** from **updateVesselTrip**
 * @returns Trip with prediction fields and any leave-dock actualization applied
 */
export const applyVesselPredictionsFromLoadedModels = async (
  predictionModelParametersByPairKey:
    | PredictionModelParametersByPairKey
    | undefined,
  coreTrip: ConvexVesselTrip
): Promise<ConvexVesselTripWithML> => {
  const specs = getRunnablePredictionSpecsFromTrip(coreTrip);
  const withPredictions =
    specs.length === 0
      ? coreTrip
      : await appendPredictionsFromLoadedModels(
          predictionModelParametersByPairKey,
          coreTrip,
          specs
        );

  return actualizePredictionsOnLeaveDock(withPredictions);
};
