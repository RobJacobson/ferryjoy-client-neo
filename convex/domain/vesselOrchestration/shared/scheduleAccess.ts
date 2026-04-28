/**
 * Shared schedule-backed lookup contract for trip-field continuity.
 */

import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled/schemas";

/**
 * Narrow schedule access used by trip-field continuity.
 *
 * Implementations may load from targeted Convex queries or in-test fixtures,
 * but callers only ask for the schedule evidence they need.
 */
export type ScheduleContinuityAccess = {
  /**
   * Loads one inferred segment by `ScheduleKey`.
   *
   * The returned segment should already include any next-leg continuity fields
   * that can be inferred for that departure.
   */
  getScheduledSegmentByKey: (
    scheduleKey: string
  ) => Promise<ConvexInferredScheduledSegment | null>;
  /**
   * Loads same-vessel scheduled departures for one sailing day in ascending
   * departure order.
   */
  getScheduledDeparturesForVesselAndSailingDay: (
    vesselAbbrev: string,
    sailingDay: string
  ) => Promise<ReadonlyArray<ConvexScheduledDockEvent>>;
};
