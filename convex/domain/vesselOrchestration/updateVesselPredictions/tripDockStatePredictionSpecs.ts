/**
 * Selects which vessel-trip prediction specs apply from **`AtDock`**: the at-dock
 * family while tied up, the at-sea family while underway. Those registries use
 * different features and anchors; this module keeps exactly one family active per
 * ping so inference stays aligned with physical state.
 */

import {
  isPredictionReadyTrip,
  PREDICTION_SPECS,
  type PredictionSpec,
} from "domain/ml/prediction/vesselTripPredictions";
import type { ModelType } from "domain/ml/shared/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Returns prediction specs for this trip based on whether the vessel is at dock.
 *
 * @param trip - Active or proposal trip row the orchestrator runs inference on
 * @returns **`PREDICTION_SPECS["at-dock"]`** or **`["at-sea"]`**, in registry order
 */
export const getPredictionSpecsFromTrip = (
  trip: ConvexVesselTrip
): readonly PredictionSpec[] =>
  PREDICTION_SPECS[trip.AtDock === true ? "at-dock" : "at-sea"];

/**
 * Returns the phase-valid prediction specs that have all required trip inputs.
 *
 * This is the shared gate for both model-parameter loading and inference so the
 * orchestrator does not load model docs for predictions that cannot run.
 */
export const getRunnablePredictionSpecsFromTrip = (
  trip: ConvexVesselTrip
): readonly PredictionSpec[] => {
  const specs = getPredictionSpecsFromTrip(trip);
  if (!isPredictionReadyTrip(trip)) {
    return [];
  }

  return specs.filter((spec) => {
    if (spec.requiresDepartureActual && trip.LeftDockActual == null) {
      return false;
    }
    return spec.getAnchorMs(trip) !== null;
  });
};

/**
 * Returns model-type ids for loading production parameters for this trip’s dock
 * vs underway branch (same routing as {@link getPredictionSpecsFromTrip}).
 *
 * @param trip - Same trip row as for {@link getPredictionSpecsFromTrip}
 * @returns Model types in registry order for **`getPredictionModelParameters`**
 */
export const getPredictionModelTypesFromTrip = (
  trip: ConvexVesselTrip
): ModelType[] =>
  getRunnablePredictionSpecsFromTrip(trip).map((spec) => spec.modelType);
