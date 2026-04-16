/**
 * Public timeline-row domain exports for schedule, actual, and prediction
 * assembly helpers.
 */

export type {
  ActiveTripForPhysicalActualReconcile,
  TripContextForActualRow,
} from "./bindActualRowsToTrips";
export {
  enrichActualBoundaryPatchesWithTripContext,
  indexActiveTripsByVesselAbbrev,
  indexTripsBySegmentKey,
} from "./bindActualRowsToTrips";
export {
  buildActualBoundaryEventFromPatch,
  buildActualBoundaryEvents,
} from "./buildActualRows";
export {
  buildPredictedBoundaryClearEffect,
  buildPredictedBoundaryProjectionEffect,
} from "./buildPredictedProjectionEffects";
export { buildScheduledBoundaryEvents } from "./buildScheduledRows";
export { mergeTimelineRows } from "./mergeTimelineRows";
