import type { ScheduledSegmentTables } from "../scheduleContinuity";

import type { ScheduleSnapshot } from "./scheduleSnapshotTypes";

/**
 * Prefetched {@link ScheduledSegmentTables} for one sailing day.
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
