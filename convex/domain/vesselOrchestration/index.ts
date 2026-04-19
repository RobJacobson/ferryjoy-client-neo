/**
 * Vessel orchestration domain: trip/timeline helpers.
 *
 * Post-fetch DB writes for one pass are sequenced in Convex
 * `functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`), using
 * `computeVesselTripsWithClock` for the trip branch.
 */

export {
  computeVesselTripsWithClock,
  type VesselTripsWithClock,
  type VesselTripsWithClockOptions,
} from "./computeVesselTripsWithClock";
export * as orchestratorTick from "./orchestratorTick";
