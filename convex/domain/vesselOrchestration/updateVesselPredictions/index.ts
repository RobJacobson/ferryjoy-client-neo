/**
 * **updateVesselPredictions** — ML attachment and `vesselTripPredictions` row DTOs
 * for one ping. Compare-then-write is in `functions/vesselTripPredictions`.
 *
 * **Public surface**
 * - {@link updateVesselPredictions} — same pass plus timeline ML handoff (orchestrator)
 * - {@link predictionPreloadFromVesselTripUpdate} — terminal-pair preload request
 * - {@link modelTypesForTripPhase} — model types for the trip's at-dock / at-sea phase
 *
 * Other helpers (`applyVesselPredictions`, `appendPredictions`, policy gates, etc.)
 * are internal to this folder; tests may import them via relative paths.
 */

export {
  type PredictionPreloadRequest,
  predictionPreloadFromVesselTripUpdate,
} from "./predictionContextRequests";
export {
  modelTypesForTripPhase,
  predictionSpecsForTripPhase,
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
