/**
 * Vessel orchestration domain: trip/timeline helpers and passenger-terminal gating.
 *
 * Post-fetch orchestration for one tick lives in Convex
 * `functions/vesselOrchestrator` (`executeVesselOrchestratorTick`).
 */

export {
  getPassengerTerminalAbbrevs,
  isPassengerTerminalAbbrev,
  isTripEligibleLocation,
} from "./updateVesselTrips";
