/**
 * Public entry for **updateVesselTrips**: tick pipeline,
 * continuity adapters, read-model helpers, and depart-next policy symbols used by
 * the orchestrator, Convex queries/mutations, and peer domain (`shared/`
 * for handshake DTOs with predictions/timeline, `orchestratorTick`).
 *
 * **Imports:** Supported symbols live here only. Do not import other
 * `updateVesselTrips/...` leaf paths from outside this folder (see
 * `docs/engineering/imports-and-module-boundaries-memo.md`).
 *
 * See `README.md` and `../architecture.md` §10.
 */

// --- Continuity (docked identity) ---
export type { ScheduledSegmentLookup } from "./continuity/resolveDockedScheduledSegment";
export type { DockedScheduledSegmentSource } from "./continuity/types";
// --- Depart-next policy (eventsPredicted / vesselTrips mutations) ---
export type { DepartNextLegContext } from "./mutations/departNextActualization";
export {
  DEPART_NEXT_ML_PREDICTION_TYPES,
  resolveDepartNextLegContext,
} from "./mutations/departNextActualization";
// --- Tick pipeline ---
export { createDefaultProcessVesselTripsDeps } from "./processTick/defaultProcessVesselTripsDeps";
export {
  computeVesselTripsBundle,
  type ProcessVesselTripsDeps,
} from "./processTick/processVesselTrips";
export { computeShouldRunPredictionFallback } from "./processTick/tickPredictionPolicy";
// --- Read model (query-time) ---
export {
  dedupeTripDocBatchesByTripKey,
  dedupeTripDocsByTripKey,
} from "./read/dedupeTripDocsByTripKey";
export { mergeTripsWithPredictions } from "./read/mergeTripsWithPredictions";
// --- Types shared with handshake/persistence consumers (not updateTimeline imports) ---
export type { BuildTripCoreResult } from "./tripLifecycle/buildTrip";
export type { TripEvents } from "./tripLifecycle/tripEventTypes";
export type {
  ActiveTripsBranch,
  PendingLeaveDockEffect,
  VesselTripsComputeBundle,
} from "./tripLifecycle/vesselTripsComputeBundle";
