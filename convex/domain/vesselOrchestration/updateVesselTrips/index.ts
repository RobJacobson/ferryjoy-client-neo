/**
 * Public entry for **updateVesselTrips**: trip-tick pipeline, lifecycle result
 * types, and continuity-facing domain contracts needed to run one orchestrator
 * trip pass.
 *
 * **Imports:** Supported symbols live here only. Do not import other
 * `updateVesselTrips/...` leaf paths from outside this folder (see
 * `docs/engineering/imports-and-module-boundaries-memo.md`).
 *
 * See `README.md` and `../architecture.md` §10.
 */

export {
  computeVesselTripsWithClock,
  type VesselTripsWithClock,
  type VesselTripsWithClockOptions,
} from "./processTick/computeVesselTripsWithClock";
// --- Tick pipeline ---
export { createDefaultProcessVesselTripsDeps } from "./processTick/defaultProcessVesselTripsDeps";
export {
  computeVesselTripsBundle,
  type ProcessVesselTripsDeps,
} from "./processTick/processVesselTrips";
export { computeShouldRunPredictionFallback } from "./processTick/tickPredictionPolicy";
// --- Types shared with handshake/persistence consumers (not updateTimeline imports) ---
export type { BuildTripCoreResult } from "./tripLifecycle/buildTrip";
export type { TripEvents } from "./tripLifecycle/tripEventTypes";
export type {
  ActiveTripsBranch,
  PendingLeaveDockEffect,
  VesselTripsComputeBundle,
} from "./tripLifecycle/vesselTripsComputeBundle";
