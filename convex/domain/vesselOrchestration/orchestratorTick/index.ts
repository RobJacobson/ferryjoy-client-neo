/**
 * Post-trip table writes for the vessel orchestrator (pure/domain).
 * `functions/vesselOrchestrator` calls these and runs Convex mutations.
 */

export {
  buildMlOverlayFromTripsCompute,
  buildOrchestratorTimelineProjectionInput,
  buildVesselTripPredictionProposals,
  buildVesselTripPredictionWrites,
  mergeTripApplyWithMlForTimeline,
  type VesselTripPredictionsMutationArgs,
  type VesselTripPredictionWrites,
  vesselTripPredictionProposalsFromMlOverlay,
} from "./materializePostTripTableWrites";
export {
  persistVesselTripsCompute,
  type VesselTripTableMutations,
  type VesselTripUpsertBatchResult,
} from "./persistVesselTripsCompute";
export {
  buildVesselTripsExecutionPayloads,
  completedFactsForSuccessfulHandoffs,
  type VesselTripsExecutionPayload,
} from "./vesselTripsExecutionPayloads";
