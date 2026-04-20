import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import type { ScheduledSegmentLookup } from "../continuity";

import type { ScheduleSnapshot } from "./scheduleSnapshotTypes";

/**
 * In-memory {@link ScheduledSegmentLookup} backed by a prefetched {@link ScheduleSnapshot}.
 */
export const createScheduledSegmentLookupFromSnapshot = (
  snapshot: ScheduleSnapshot
): ScheduledSegmentLookup => {
  const departuresBySegmentKey = buildDeparturesBySegmentKey(snapshot);

  return {
    getScheduledDepartureEventBySegmentKey: (
      segmentKey: string
    ): ConvexScheduledDockEvent | null =>
      departuresBySegmentKey.get(segmentKey) ?? null,
    getScheduledDockEventsForSailingDay: (args: {
      vesselAbbrev: string;
      sailingDay: string;
    }): ConvexScheduledDockEvent[] =>
      (snapshot.eventsByVesselAbbrev[args.vesselAbbrev] ?? []).filter(
        (event) => event.SailingDay === args.sailingDay
      ),
  };
};

/**
 * Derives departure-event lookup by segment key from grouped snapshot rows.
 *
 * @param snapshot - Today-only schedule snapshot grouped by vessel
 * @returns Segment-key map used by `getScheduledDepartureEventBySegmentKey`
 */
const buildDeparturesBySegmentKey = (
  snapshot: ScheduleSnapshot
): Map<string, ConvexScheduledDockEvent> =>
  new Map(
    Object.values(snapshot.eventsByVesselAbbrev)
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
