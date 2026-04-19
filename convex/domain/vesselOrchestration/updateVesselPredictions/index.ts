/**
 * Orchestrator concern **updateVesselPredictions**: ML attachment,
 * upsert decisions for **`vesselTripPredictions`**, and strip helpers
 * for one proposed trip per tick. Implementation modules live in this folder;
 * import from here for a stable concern boundary.
 *
 * Stage A canonical contracts live in `contracts.ts`. The current
 * `runUpdateVesselPredictions` implementation remains a transitional legacy
 * runner until the plain-data prediction context migration lands.
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
  buildMlOverlayFromTripsCompute,
  buildVesselTripPredictionProposals,
  runUpdateVesselPredictions,
  type VesselTripPredictionsMutationArgs,
  type VesselTripPredictionWrites,
  vesselTripPredictionProposalsFromMlOverlay,
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
