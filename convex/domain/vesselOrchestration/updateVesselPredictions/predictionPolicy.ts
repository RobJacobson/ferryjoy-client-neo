/**
 * Picks ML phase from live physical state (at dock vs underway) so dock and sea
 * model families stay split: they use different features and anchors, and the
 * orchestrator must apply exactly one family per ping.
 */

import {
  PREDICTION_SPECS,
  type PredictionSpec,
} from "domain/ml/prediction/vesselTripPredictions";
import type { ModelType } from "domain/ml/shared/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Resolves the spec list for this ping by matching the trip's physical phase
 * to the at-dock or at-sea registry. That blocks sea-phase models on dock rows
 * and the reverse, so we avoid useless inference and predictions on fields that
 * do not apply to this state.
 *
 * @param trip - Supplies the trip row this ping runs ML against
 * @returns Lists the specs permitted for this phase, in registry order
 */
export const predictionSpecsForTripPhase = (
  trip: ConvexVesselTrip
): readonly PredictionSpec[] =>
  PREDICTION_SPECS[trip.AtDock === true ? "at-dock" : "at-sea"];

/**
 * Derives model-type ids for the production-parameter preload from the
 * phase-resolved specs. Production weights live per terminal pair and model type,
 * so requesting only those types avoids pulling the full per-route catalog every
 * ping.
 *
 * @param trip - Supplies the same ping trip row as {@link predictionSpecsForTripPhase}
 * @returns Lists model types in the same order as the resolved specs
 */
export const modelTypesForTripPhase = (trip: ConvexVesselTrip): ModelType[] =>
  predictionSpecsForTripPhase(trip).map((spec) => spec.modelType);
