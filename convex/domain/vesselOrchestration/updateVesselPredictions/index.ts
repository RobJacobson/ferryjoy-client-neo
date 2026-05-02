/**
 * **updateVesselPredictions** — ML attachment and `vesselTripPredictions` row DTOs
 * for one ping. Compare-then-write is in `functions/vesselTripPredictions`.
 *
 * **Public surface**
 * - {@link updateVesselPredictions} — same pass plus timeline ML handoff (orchestrator)
 * - {@link predictionModelLoadRequestForTripUpdate} — terminal-pair preload request
 * - {@link predictionModelTypesForTrip} — model types applicable to a trip's phase
 *
 * Other helpers (`applyVesselPredictions`, `appendPredictions`, policy gates, etc.)
 * are internal to this folder; tests may import them via relative paths.
 */

export {
  type PredictionModelLoadRequest,
  predictionModelLoadRequestForTripUpdate,
} from "./predictionContextRequests";
export {
  predictionModelTypesForTrip,
  predictionSpecsForTrip,
} from "./predictionPolicy";
export type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
  VesselTripPredictionRow,
} from "./types";
export {
  type UpdateVesselPredictionsOutput,
  updateVesselPredictions,
} from "./updateVesselPredictions";
