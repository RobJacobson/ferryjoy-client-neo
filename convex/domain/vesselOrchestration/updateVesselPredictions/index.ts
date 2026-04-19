/**
 * Orchestrator concern **updateVesselPredictions**: ML attachment,
 * upsert decisions for **`vesselTripPredictions`**, and strip helpers
 * for one proposed trip per tick. Implementation modules live in this folder;
 * import from here for a stable concern boundary.
 *
 * Stage A canonical contracts live in `contracts.ts`. **`runUpdateVesselPredictions`**
 * is the Stage D plain-data runner: it consumes **`tripComputations`** plus a
 * functions-preloaded **`predictionContext`** and returns **`predictedTripComputations`**
 * for timeline.
 */

export {
  applyVesselPredictions,
  type VesselPredictionGates,
  type VesselTripCoreProposal,
} from "./applyVesselPredictions";
export type {
  PredictedTripComputation,
  RunUpdateVesselPredictionsInput,
  RunUpdateVesselPredictionsOutput,
  TripPredictionSet,
  VesselPredictionContext,
  VesselTripPredictionRow,
} from "./contracts";
export {
  runUpdateVesselPredictions,
} from "./orchestratorPredictionWrites";
export {
  convexPredictionFromVesselTripPredictionRow,
  normalizeConvexPredictionForOverlayEquality,
  overlayPredictionProjectionsEqual,
} from "./predictionCompare";
export { stripTripPredictionsForStorage } from "./stripTripPredictionsForStorage";
export {
  decideVesselTripPredictionUpsert,
  type VesselTripPredictionUpsertDecision,
  vesselTripPredictionUnchangedForPersist,
} from "./vesselTripPredictionPersistPlan";
export { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";
