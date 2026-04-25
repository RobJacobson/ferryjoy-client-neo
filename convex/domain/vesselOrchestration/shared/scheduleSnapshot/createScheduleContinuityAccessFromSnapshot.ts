/**
 * In-memory schedule continuity access for tests and non-hot-path callers.
 *
 * See `./README.md`: this is not production `vesselOrchestratorScheduleSnapshots` persistence.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled";
import type { ScheduleContinuityAccess } from "../scheduleContinuity";
import type {
  CompactScheduledDepartureEvent,
  ScheduleSnapshot,
} from "./scheduleSnapshotTypes";

/**
 * Builds async schedule access backed by one materialized snapshot.
 *
 * @param snapshot - Snapshot of same-day schedule evidence
 * @param sailingDay - Sailing day to expose through the access object
 * @returns Promise-based continuity access over the snapshot contents
 */
export const createScheduleContinuityAccessFromSnapshot = (
  snapshot: ScheduleSnapshot,
  sailingDay: string
): ScheduleContinuityAccess => {
  const departuresByVessel =
    snapshot.SailingDay === sailingDay
      ? snapshot.scheduledDeparturesByVesselAbbrev
      : {};
  const segmentsByKey =
    snapshot.SailingDay === sailingDay
      ? snapshot.scheduledDepartureBySegmentKey
      : {};

  return {
    getScheduledSegmentByKey: async (
      scheduleKey: string
    ): Promise<ConvexInferredScheduledSegment | null> =>
      segmentsByKey[scheduleKey] ?? null,
    getScheduledDeparturesForVesselAndSailingDay: async (
      vesselAbbrev: string,
      requestedSailingDay: string
    ): Promise<ReadonlyArray<CompactScheduledDepartureEvent>> =>
      requestedSailingDay !== sailingDay
        ? []
        : (departuresByVessel[vesselAbbrev] ?? []),
  };
};
