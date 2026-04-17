/**
 * Vessel orchestrator tick pipeline: coordination and passenger-terminal gating.
 *
 * Convex actions in `functions/vesselOrchestrator` load data, inject adapters, and
 * call {@link runVesselOrchestratorTick}.
 */

export { runVesselOrchestratorTick } from "./runVesselOrchestratorTick";
export type {
  UpdateVesselOrchestratorResult,
  VesselOrchestratorTickDeps,
  VesselOrchestratorTickInput,
  VesselOrchestratorTickMetrics,
  VesselOrchestratorTickResult,
} from "./types";
export {
  getPassengerTerminalAbbrevs,
  isPassengerTerminalAbbrev,
  isTripEligibleLocation,
} from "./updateVesselTrips";
