/**
 * **updateVesselPredictions** — ML attachment and `vesselTripPredictions` row DTOs
 * for one ping. Compare-then-write is in `functions/vesselTripPredictions`.
 *
 * **Public surface**
 * - {@link updateVesselPredictions} — same pass plus timeline ML handoff (orchestrator)
 * - {@link predictionInputsFromTripUpdate} — derive prediction inputs from a `VesselTripUpdate`
 * - {@link predictionModelLoadRequestsForTripUpdate} — terminal-pair preload requests
 * - {@link predictionModelTypesForTrip} — model types applicable to a trip's phase
 *
 * Other helpers (`applyVesselPredictions`, `appendPredictions`, policy gates, etc.)
 * are internal to this folder; tests may import them via relative paths.
 */

export type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
  VesselTripPredictionRow,
} from "./contracts";
export {
  type PredictionModelLoadRequest,
  predictionModelLoadRequestsForTripUpdate,
} from "./predictionContextRequests";
export {
  type PredictionInputsFromTripUpdate,
  predictionInputsFromTripUpdate,
} from "./predictionInputsFromTripUpdate";
export { predictionModelTypesForTrip } from "./predictionPolicy";
export {
  type UpdateVesselPredictionsOutput,
  updateVesselPredictions,
} from "./updateVesselPredictions";
