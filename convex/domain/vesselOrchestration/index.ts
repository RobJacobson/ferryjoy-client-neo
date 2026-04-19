/**
 * Vessel orchestration domain: trip/timeline helpers.
 *
 * Post-fetch DB writes for one pass are sequenced in Convex
 * `functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`), using
 * `computeVesselTripsWithClock` for the trip branch and `tickLifecycle` for
 * trip/timeline handshake types. The orchestrator creates
 * `tickStartedAt` once per run; {@link computeVesselTripsWithClock} requires it
 * (no `Date.now()` default in domain).
 */

export {
  computeVesselTripsWithClock,
  type VesselTripsWithClock,
  type VesselTripsWithClockOptions,
} from "./computeVesselTripsWithClock";
export * as orchestratorTick from "./orchestratorTick";
export * as tickLifecycle from "./tickLifecycle";
