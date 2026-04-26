/**
 * **updateVesselPredictions** — ML attachment and `vesselTripPredictions` row DTOs
 * for one ping. Compare-then-write is in `functions/vesselTripPredictions`.
 *
 * **Public surface**
 * - {@link updateVesselPredictions} — same pass plus timeline ML handoff (orchestrator)
 * - {@link predictionModelTypesForTrip} — terminal-pair preload requests (orchestrator)
 *
 * Other helpers (`applyVesselPredictions`, `appendPredictions`, policy gates, etc.)
 * are internal to this folder; tests may import them via relative paths.
 */

export {
  type UpdateVesselPredictionsOutput,
  updateVesselPredictions,
} from "./updateVesselPredictions";
export type {
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
  VesselTripPredictionRow,
} from "./contracts";
export { predictionModelTypesForTrip } from "./predictionPolicy";
