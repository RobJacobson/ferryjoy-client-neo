/**
 * Vessel orchestration domain: trip/timeline helpers and passenger-terminal gating.
 *
 * Post-fetch DB writes for one tick are sequenced in Convex
 * `functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`), using
 * `computeVesselOrchestratorTripTickWrites` for the trip branch.
 */

export {
  type ComputeVesselOrchestratorTripTickWritesOptions,
  computeVesselOrchestratorTripTickWrites,
  type VesselOrchestratorTripTickWrites,
} from "./computeVesselOrchestratorTripTickWrites";
export {
  getPassengerTerminalAbbrevs,
  isPassengerTerminalAbbrev,
  isTripEligibleLocation,
  selectTripEligibleLocations,
} from "./updateVesselTrips";
export { nowMsForVesselOrchestratorTick } from "./vesselOrchestratorTickClock";
