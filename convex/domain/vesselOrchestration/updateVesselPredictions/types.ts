/**
 * Public contracts for vessel-trip predictions: prediction-parameter lookup
 * shapes and the combined result passed to persistence and timeline assembly.
 */

import type { ProductionModelParameters } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import type { PredictedTripTimelineHandoff } from "domain/vesselOrchestration/updateTimeline";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";

/**
 * Prediction model parameters keyed by canonical terminal pair, then model type.
 * Matches the plain object returned by **`getPredictionModelParameters`**.
 *
 * Values use **`ProductionModelParameters`** from the ML access layer (stored
 * coefficient/feature rows).
 */
export type PredictionModelParametersByPairKey = Readonly<
  Record<string, Partial<Record<ModelType, ProductionModelParameters | null>>>
>;

/**
 * Arguments for **`getPredictionModelParameters`**: which terminal pair and
 * which prediction model types to load for the active trip’s dock vs underway
 * state.
 */
export type PredictionModelParametersRequest = {
  pairKey: string;
  modelTypes: Array<ModelType>;
};

/**
 * Small port used by {@link getVesselTripPredictionsFromTripUpdate} so domain
 * stays free of `ActionCtx`. **`getVesselTripPredictionsForTripUpdate`** (orchestrator) wires this
 * using Convex actions; unit tests supply an in-memory stub.
 */
export type VesselTripPredictionDeps = {
  loadPredictionModelParameters: (
    request: PredictionModelParametersRequest
  ) => Promise<PredictionModelParametersByPairKey>;
};

/**
 * Outcome of enriching the active trip from prediction parameters and deriving
 * persistence rows plus same-update timeline handoffs.
 */
export type VesselTripPredictionsFromTripUpdateResult = {
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  predictedTripTimelineHandoffs: ReadonlyArray<PredictedTripTimelineHandoff>;
};
