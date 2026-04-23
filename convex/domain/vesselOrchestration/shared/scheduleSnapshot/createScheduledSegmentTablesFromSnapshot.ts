import type { ScheduledSegmentTables } from "../scheduleContinuity";

import type { ScheduleSnapshot } from "./scheduleSnapshotTypes";

/**
 * Narrows the prefetched schedule snapshot into the same-day schedule evidence
 * tables used by trip-field inference.
 */
export const createScheduledSegmentTablesFromSnapshot = (
  snapshot: ScheduleSnapshot,
  sailingDay: string
): ScheduledSegmentTables => {
  return {
    sailingDay,
    scheduledDepartureBySegmentKey:
      snapshot.SailingDay === sailingDay ? snapshot.scheduledDepartureBySegmentKey : {},
    scheduledDeparturesByVesselAbbrev:
      snapshot.SailingDay === sailingDay
        ? snapshot.scheduledDeparturesByVesselAbbrev
        : {},
  };
};
