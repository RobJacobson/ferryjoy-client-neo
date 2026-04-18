/**
 * Vessel orchestration domain: trip/timeline helpers and passenger-terminal gating.
 *
 * Post-fetch DB writes for one tick are sequenced in Convex
 * `functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`), using
 * `computeOrchestratorTripWrites` for the trip branch.
 */

export {
  computeOrchestratorTripWrites,
  type OrchestratorTripWrites,
  type OrchestratorTripWritesOptions,
} from "./computeOrchestratorTripWrites";
export {
  getPassengerTerminalAbbrevs,
  isPassengerTerminalAbbrev,
  isTripEligibleLocation,
  selectTripEligibleLocations,
} from "./updateVesselTrips";
