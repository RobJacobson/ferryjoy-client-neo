/**
 * Vessel orchestrator tick pipeline: coordination and passenger-terminal gating.
 *
 * Convex actions in `functions/vesselOrchestrator` load data, inject adapters, and
 * call {@link runVesselOrchestratorTick}.
 */

export {
  getPassengerTerminalAbbrevs,
  isPassengerTerminalAbbrev,
  isTripEligibleLocation,
} from "./passengerTerminalEligibility";
export { runVesselOrchestratorTick } from "./runVesselOrchestratorTick";
export type {
  VesselOrchestratorTickDeps,
  VesselOrchestratorTickInput,
  VesselOrchestratorTickResult,
} from "./types";
