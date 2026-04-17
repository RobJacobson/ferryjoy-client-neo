/**
 * Orchestrator concern **updateVesselPredictions**: ML attachment and
 * persistence strip helpers for one proposed trip per tick. Implementation
 * modules live in this folder; import from here for a stable concern boundary.
 */

export {
  applyVesselPredictions,
  type VesselPredictionGates,
  type VesselTripCoreProposal,
} from "./applyVesselPredictions";
export { stripTripPredictionsForStorage } from "./stripTripPredictionsForStorage";
