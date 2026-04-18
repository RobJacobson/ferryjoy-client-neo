/**
 * Orchestrator concern **updateVesselPredictions**: ML attachment,
 * compare-then-write planning for **`vesselTripPredictions`**, and strip helpers
 * for one proposed trip per tick. Implementation modules live in this folder;
 * import from here for a stable concern boundary.
 */

export {
  applyVesselPredictions,
  type VesselPredictionGates,
  type VesselTripCoreProposal,
} from "./applyVesselPredictions";
export {
  convexPredictionFromVesselTripPredictionRow,
  normalizeConvexPredictionForOverlayEquality,
  overlayPredictionProjectionsEqual,
} from "./predictionCompare";
export { stripTripPredictionsForStorage } from "./stripTripPredictionsForStorage";
export {
  planVesselTripPredictionWrite,
  type VesselTripPredictionWritePlan,
  vesselTripPredictionUnchangedForPersist,
} from "./vesselTripPredictionPersistPlan";
export { vesselTripPredictionProposalsFromMlTrip } from "./vesselTripPredictionProposalsFromMlTrip";
