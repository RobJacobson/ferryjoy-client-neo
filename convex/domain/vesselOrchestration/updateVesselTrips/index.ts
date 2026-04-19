/**
 * Public entry for **updateVesselTrips**: tick pipeline, schedule snapshot wiring,
 * continuity adapters, read-model helpers, and depart-next policy symbols used by
 * the orchestrator, Convex queries/mutations, and peer domain (`updateTimeline`,
 * `orchestratorTick`, `shared/`).
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
// --- Bulk schedule snapshot ---
export { buildScheduleSnapshotQueryArgs } from "./snapshot/buildScheduleSnapshotQueryArgs";
export { createScheduledSegmentLookupFromSnapshot } from "./snapshot/createScheduledSegmentLookupFromSnapshot";
export { scheduleSnapshotCompositeKey } from "./snapshot/scheduleSnapshotCompositeKey";
export {
  MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS,
  MAX_SCHEDULE_SNAPSHOT_SEGMENT_KEYS,
  MAX_SCHEDULE_SNAPSHOT_VESSEL_ABBREVS,
  MAX_SCHEDULE_SNAPSHOT_VESSEL_SAILING_PAIRS,
} from "./snapshot/scheduleSnapshotLimits";
export type { ScheduleSnapshot } from "./snapshot/scheduleSnapshotTypes";
// --- Types shared with timeline / persistence ---
export type { BuildTripCoreResult } from "./tripLifecycle/buildTrip";
export type { TripEvents } from "./tripLifecycle/tripEventTypes";
export type {
  ActiveTripsBranch,
  PendingLeaveDockEffect,
  VesselTripsComputeBundle,
} from "./tripLifecycle/vesselTripsComputeBundle";
