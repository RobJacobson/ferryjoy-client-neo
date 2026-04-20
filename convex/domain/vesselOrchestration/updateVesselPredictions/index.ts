/**
 * **updateVesselPredictions** — ML attachment and `vesselTripPredictions` row DTOs
 * for one tick. Compare-then-write is in `functions/vesselTripPredictions`.
 *
 * **Public surface**
 * - {@link runUpdateVesselPredictions} — `{ predictionRows }` only
 * - {@link runVesselPredictionTick} — same pass plus timeline ML handoff (orchestrator)
 * - {@link predictionModelTypesForTrip} — terminal-pair preload requests (orchestrator)
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

export { predictionModelTypesForTrip } from "./predictionPolicy";

export {
  type RunVesselPredictionTickOutput,
  runUpdateVesselPredictions,
  runVesselPredictionTick,
} from "./runVesselPredictionTick";
