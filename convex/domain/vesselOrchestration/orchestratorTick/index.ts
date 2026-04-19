/**
 * Post-trip table writes for the vessel orchestrator (pure/domain).
 * `functions/vesselOrchestrator` calls these and runs Convex mutations.
 */

export { actualDepartMsForLeaveDockEffect } from "./leaveDockActualization";
export {
  buildMlOverlayFromTripsCompute,
  buildOrchestratorTimelineProjectionInput,
  buildVesselTripPredictionProposals,
  mergeTripApplyWithMlForTimeline,
  runUpdateVesselPredictions,
  runUpdateVesselTimeline,
  type VesselTripPredictionsMutationArgs,
  type VesselTripPredictionWrites,
  vesselTripPredictionProposalsFromMlOverlay,
} from "./materializePostTripTableWrites";
export {
  persistVesselTripsCompute,
  persistVesselTripWriteSet,
  type VesselTripTableMutations,
  type VesselTripUpsertBatchResult,
} from "./persistVesselTripsCompute";
export {
  buildTripsComputeStorageRows,
  completedFactsForSuccessfulHandoffs,
  type TripsComputeStorageRows,
} from "./tripsComputeStorageRows";
export {
  buildVesselTripTickWriteSetFromBundle,
  type VesselTripTickWriteSet,
} from "./vesselTripTickWriteSet";
