/**
 * Orchestrator concern **updateVesselPredictions**: ML attachment,
 * upsert decisions for **`vesselTripPredictions`**, and strip helpers
 * for trip rows processed on each tick. Implementation modules live in this
 * folder; import from here for a stable concern boundary.
 *
 * Stage A canonical contracts live in `contracts.ts`. **`runUpdateVesselPredictions`**
 * is the Stage D plain-data runner: it consumes trip rows plus a
 * functions-preloaded **`predictionContext`** and returns predicted trip
 * handoffs for timeline/persistence assembly.
 */

export {
  applyVesselPredictions,
  type VesselTripCoreProposal,
} from "./applyVesselPredictions";
export type {
  PredictedTripComputation,
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  VesselPredictionContext,
  VesselTripPredictionRow,
} from "./contracts";
export { runUpdateVesselPredictions } from "./orchestratorPredictionWrites";
export {
  convexPredictionFromVesselTripPredictionRow,
  normalizeConvexPredictionForOverlayEquality,
  overlayPredictionProjectionsEqual,
} from "./predictionCompare";
export {
  predictionModelTypesForTrip,
  shouldRunAtDockPredictions,
  shouldRunAtSeaPredictions,
} from "./predictionPolicy";
export { stripTripPredictionsForStorage } from "./stripTripPredictionsForStorage";
export {
  decideVesselTripPredictionUpsert,
  type VesselTripPredictionUpsertDecision,
  vesselTripPredictionUnchangedForPersist,
} from "./vesselTripPredictionPersistPlan";
export { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";
