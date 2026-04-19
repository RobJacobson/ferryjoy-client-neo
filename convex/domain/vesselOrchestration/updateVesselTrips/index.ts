/**
 * Public entry for **updateVesselTrips** symbols consumed by the orchestrator,
 * `computeVesselTripsWithClock`, and tests.
 *
 * **Imports:** Prefer this module for the exports below; import peer concerns from
 * their own roots (`updateTimeline`, `updateVesselPredictions`) or leaf paths under
 * this folder when you need something not listed here.
 *
 * See `README.md` and `../architecture.md` §10.
 */

export { createDefaultProcessVesselTripsDeps } from "./processTick/defaultProcessVesselTripsDeps";
export {
  computeVesselTripsBundle,
  type ProcessVesselTripsDeps,
} from "./processTick/processVesselTrips";
export { computeShouldRunPredictionFallback } from "./processTick/tickPredictionPolicy";
export { buildScheduleSnapshotQueryArgs } from "./snapshot/buildScheduleSnapshotQueryArgs";
export { createScheduledSegmentLookupFromSnapshot } from "./snapshot/createScheduledSegmentLookupFromSnapshot";
export { scheduleSnapshotCompositeKey } from "./snapshot/scheduleSnapshotCompositeKey";
export type { ScheduleSnapshot } from "./snapshot/scheduleSnapshotTypes";
export {
  MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS,
  MAX_SCHEDULE_SNAPSHOT_SEGMENT_KEYS,
  MAX_SCHEDULE_SNAPSHOT_VESSEL_ABBREVS,
  MAX_SCHEDULE_SNAPSHOT_VESSEL_SAILING_PAIRS,
} from "./snapshot/scheduleSnapshotLimits";
export type { BuildTripCoreResult } from "./tripLifecycle/buildTrip";
export {
  type ProcessCompletedTripsDeps,
  processCompletedTrips,
} from "./tripLifecycle/processCompletedTrips";
export type { TripEvents } from "./tripLifecycle/tripEventTypes";
export type {
  ActiveTripsBranch,
  VesselTripsComputeBundle,
} from "./tripLifecycle/vesselTripsComputeBundle";
