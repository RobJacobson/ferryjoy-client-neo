/**
 * Simple phase helpers for prediction runs.
 *
 * Predictions now re-run every ping whenever a trip is in the right phase for
 * that model family. There is no event/timer gate on the orchestrator path.
 */

import {
  PREDICTION_SPECS,
  type PredictionSpec,
} from "domain/ml/prediction/vesselTripPredictions";
import type { ModelType } from "domain/ml/shared/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/** Trip shape needed to decide which prediction family can run this ping. */
type PredictionPhaseTrip = ConvexVesselTrip;

/**
 * Whether the trip row is physically at dock (`PREDICTION_SPECS` at-dock family).
 *
 * @param trip - Vessel trip row (`AtDock === true`)
 * @returns True when dock-phase prediction specs apply
 */
export const isTripAtDock = (trip: PredictionPhaseTrip): boolean =>
  trip.AtDock === true;

/**
 * Whether the trip row is underway — not at dock (`PREDICTION_SPECS` at-sea family).
 *
 * @param trip - Vessel trip row (`AtDock === false`)
 * @returns True when at-sea prediction specs apply
 */
export const isTripAtSea = (trip: PredictionPhaseTrip): boolean =>
  trip.AtDock === false;

/**
 * Prediction specs that apply to this trip row given its at-dock / at-sea phase.
 *
 * @param trip - Vessel trip row whose `AtDock` flag selects the spec family
 * @returns Specs whose `phase` matches the trip’s physical state
 */
export const predictionSpecsForTripPhase = (
  trip: PredictionPhaseTrip
): PredictionSpec[] =>
  Object.values(PREDICTION_SPECS).filter((spec) => {
    if (isTripAtDock(trip)) {
      return spec.phase === "at-dock";
    }
    if (isTripAtSea(trip)) {
      return spec.phase === "at-sea";
    }
    return false;
  });

/**
 * Model types to run for this trip row, derived from its prediction phase.
 *
 * @param trip - Vessel trip row passed to phase filtering
 * @returns `modelType` values from {@link predictionSpecsForTripPhase}
 */
export const modelTypesForTripPhase = (
  trip: PredictionPhaseTrip
): ModelType[] =>
  predictionSpecsForTripPhase(trip).map((spec) => spec.modelType);
