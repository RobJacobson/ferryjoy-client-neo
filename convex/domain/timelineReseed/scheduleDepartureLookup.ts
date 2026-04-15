/**
 * Fallback alignment of sparse WSF vessel-history rows to hydrated event
 * records when strict terminal resolution fails.
 */

import type { ConvexVesselTimelineEventRecord } from "../../functions/vesselTimeline/schemas";
import { groupBy } from "../../shared/groupBy";

/**
 * Builds a resolver that maps `(vessel abbrev, history scheduled departure)` to
 * a canonical segment key.
 *
 * @param seededEvents - Hydrated event records for one sailing day
 * @returns Function that resolves `SegmentKey` when present
 */
export const createSeededScheduleSegmentResolver = (
  seededEvents: ReadonlyArray<ConvexVesselTimelineEventRecord>
): ((vesselAbbrev: string, scheduledDepart: Date) => string | undefined) => {
  const depRows = seededEvents.filter(
    (event) => event.EventType === "dep-dock"
  );
  const byVessel = groupBy(depRows, (row) => row.VesselAbbrev);

  return (vesselAbbrev, scheduledDepart) => {
    const targetMs = scheduledDepart.getTime();
    return byVessel
      .get(vesselAbbrev)
      ?.find((row) => row.ScheduledDeparture === targetMs)?.SegmentKey;
  };
};
