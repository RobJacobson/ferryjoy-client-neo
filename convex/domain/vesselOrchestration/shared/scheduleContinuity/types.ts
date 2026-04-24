/**
 * Shared schedule-backed lookup types for compact schedule snapshot wiring.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { CompactScheduledDepartureEvent } from "../scheduleSnapshot/scheduleSnapshotTypes";

/**
 * Narrow schedule access used by trip-field continuity.
 *
 * Implementations may load from targeted Convex queries or from in-memory test
 * fixtures, but callers only ask for the schedule evidence they actually need.
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
  ) => Promise<ReadonlyArray<CompactScheduledDepartureEvent>>;
};
