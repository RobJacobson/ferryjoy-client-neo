import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import type { ScheduledSegmentLookup } from "../continuity";

import { scheduleSnapshotCompositeKey } from "./scheduleSnapshotCompositeKey";
import type { ScheduleSnapshot } from "./scheduleSnapshotTypes";

/**
 * In-memory {@link ScheduledSegmentLookup} backed by a prefetched {@link ScheduleSnapshot}.
 */
export const createScheduledSegmentLookupFromSnapshot = (
  snapshot: ScheduleSnapshot
): ScheduledSegmentLookup => ({
  getScheduledDepartureEventBySegmentKey: (
    segmentKey: string
  ): ConvexScheduledDockEvent | null =>
    snapshot.departuresBySegmentKey[segmentKey] ?? null,
  getScheduledDockEventsForSailingDay: (args: {
    vesselAbbrev: string;
    sailingDay: string;
  }): ConvexScheduledDockEvent[] =>
    snapshot.sameDayEventsByCompositeKey[
      scheduleSnapshotCompositeKey(args.vesselAbbrev, args.sailingDay)
    ] ?? [],
});
