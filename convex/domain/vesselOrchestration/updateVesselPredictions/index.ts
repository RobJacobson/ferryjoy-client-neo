/**
 * **updateVesselPredictions** — Prediction model–backed trip enrichment,
 * `vesselTripPredictions` proposal rows, and same-update timeline handoffs for
 * `updateTimeline`.
 *
 * **Public surface**
 * - {@link getVesselTripPredictionsFromTripUpdate} — domain entry (inject
 *   **`loadPredictionModelParameters`** for Convex or tests)
 * - {@link getPredictionModelParametersFromTripUpdate} — optional query
 *   request derived from `VesselTripUpdate`
 * - {@link getPredictionModelTypesFromTrip}, {@link getPredictionSpecsFromTrip} —
 *   at-dock vs at-sea spec routing (single source for load + inference)
 *
 * Internal helpers (`appendPredictions`, `applyVesselPredictionsFromLoadedModels`,
 * dock-state spec routing, etc.) stay inside this folder; tests may import them via
 * relative paths.
 */

export { getPredictionModelParametersFromTripUpdate } from "./getPredictionModelParametersFromTripUpdate";
export { getVesselTripPredictionsFromTripUpdate } from "./getVesselTripPredictionsFromTripUpdate";
export {
  getPredictionModelTypesFromTrip,
  getPredictionSpecsFromTrip,
} from "./tripDockStatePredictionSpecs";
export type {
  PredictionModelParametersByPairKey,
  PredictionModelParametersRequest,
  VesselTripPredictionDeps,
  VesselTripPredictionsFromTripUpdateResult,
} from "./types";
