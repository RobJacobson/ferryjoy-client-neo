/**
 * Vessel orchestration domain: trip/timeline helpers.
 *
 * Post-fetch DB writes for one tick are sequenced in Convex
 * `functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`), using
 * `computeOrchestratorTripTick` for the trip branch.
 */

export {
  computeOrchestratorTripTick,
  type OrchestratorTripTick,
  type OrchestratorTripTickOptions,
} from "./computeOrchestratorTripTick";
export * as orchestratorTick from "./orchestratorTick";
