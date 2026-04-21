import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import type { ScheduledSegmentTables } from "../scheduleContinuity";

import type { ScheduleSnapshot } from "./scheduleSnapshotTypes";

/**
 * Prefetched {@link ScheduledSegmentTables} for one sailing day.
 *
 * The snapshot may include multiple days; rows are narrowed to `sailingDay`
 * once, then departure indexing and same-vessel reads use those tables only.
 */
export const createScheduledSegmentTablesFromSnapshot = (
  snapshot: ScheduleSnapshot,
  sailingDay: string
): ScheduledSegmentTables => {
  const filtered = filterScheduleSnapshotToSailingDay(snapshot, sailingDay);
  const scheduledDepartureBySegmentKey =
    buildScheduledDepartureBySegmentKey(filtered);

  return {
    sailingDay,
    scheduledDepartureBySegmentKey,
    scheduledDockEventsByVesselAbbrev:
      filtered.scheduledDockEventsByVesselAbbrev,
  };
};

const filterScheduleSnapshotToSailingDay = (
  snapshot: ScheduleSnapshot,
  sailingDay: string
): ScheduleSnapshot => ({
  scheduledDockEventsByVesselAbbrev: Object.fromEntries(
    Object.entries(snapshot.scheduledDockEventsByVesselAbbrev).map(
      ([abbrev, events]) => [
        abbrev,
        events.filter((event) => event.SailingDay === sailingDay),
      ]
    )
  ),
});

/**
 * Departure-event lookup by segment key from grouped snapshot rows.
 *
 * @param snapshot - Schedule snapshot grouped by vessel (typically one ping day)
 * @returns Segment-key map (dep-dock boundaries only)
 */
const buildScheduledDepartureBySegmentKey = (
  snapshot: ScheduleSnapshot
): Record<string, ConvexScheduledDockEvent> =>
  Object.fromEntries(
    Object.values(snapshot.scheduledDockEventsByVesselAbbrev)
      .flat()
      .filter((event) => event.EventType === "dep-dock")
      .map((event) => [getSegmentKeyFromBoundaryKey(event.Key), event] as const)
  );

/**
 * Converts a scheduled boundary key to its segment key prefix.
 *
 * @param boundaryKey - Boundary key ending in `--dep-dock` or `--arv-dock`
 * @returns Segment key used by vessel-trip schedule fields
 */
const getSegmentKeyFromBoundaryKey = (boundaryKey: string): string =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");
