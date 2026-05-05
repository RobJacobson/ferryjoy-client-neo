/**
 * Fallback alignment of sparse WSF vessel-history rows to hydrated event
 * records when strict terminal resolution fails.
 */

import { groupBy } from "../../../shared/groupBy";
import type { DockBoundaryEventRecord } from "../types";

/**
 * Builds a closure that maps vessel abbrev and history scheduled departure to SegmentKey.
 *
 * Strict resolveVesselHistory may fail on noisy rows; history still carries
 * ScheduledDepart which should match a seeded departure rows ScheduledDeparture.
 * Pre-indexing dep-dock rows by vessel avoids scanning the full seed list per
 * history record during hydration.
 *
 * @param seededEvents - Hydrated boundary records for one sailing day
 * @returns Resolver that returns SegmentKey when a dep row matches the depart instant
 */
export const createSeededScheduleSegmentResolver = (
  seededEvents: ReadonlyArray<DockBoundaryEventRecord>
): ((vesselAbbrev: string, scheduledDepart: number) => string | undefined) => {
  const depRows = seededEvents.filter(
    (event) => event.EventType === "dep-dock"
  );
  const byVessel = groupBy(depRows, (row) => row.VesselAbbrev);

  const resolveSegmentKeyFromHistoryDepart = (
    vesselAbbrev: string,
    scheduledDepart: number
  ): string | undefined => {
    return byVessel
      .get(vesselAbbrev)
      ?.find((row) => row.ScheduledDeparture === scheduledDepart)?.SegmentKey;
  };

  return resolveSegmentKeyFromHistoryDepart;
};
