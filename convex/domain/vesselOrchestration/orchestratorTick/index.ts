/**
 * Tick persistence **materialization** for the vessel orchestrator (pure/domain).
 * `functions/vesselOrchestrator` calls these and runs Convex mutations.
 */

export {
  materializePostTripTableWrites,
  materializeVesselTripPredictionUpsertAndMergedBranch,
  type VesselTripPredictionsMutationArgs,
} from "./materializePostTripTableWrites";
export {
  buildTripTickExecutionPayloads,
  completedFactsForSuccessfulHandoffs,
  type TripTickExecutionPayload,
} from "./tripTickExecutionPayloads";
