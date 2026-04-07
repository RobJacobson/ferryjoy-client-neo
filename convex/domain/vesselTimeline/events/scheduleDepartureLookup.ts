/**
 * Fallback alignment of sparse WSF vessel-history rows to schedule segments
 * when strict terminal resolution fails. History `ScheduledDepart` is the leg’s
 * scheduled departure, so we index seeded **dep-dock** rows only: they carry the
 * same `ScheduledDeparture` as sibling **arv-dock** rows for that segment, so
 * including arv-dock would duplicate every bucket entry without adding keys.
 */

import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/schemas";
import { groupBy } from "../../../shared/groupBy";

/**
 * Builds a resolver that maps `(vessel abbrev, history scheduled departure)` to
 * a canonical segment key. Call once per sailing-day merge; the returned
 * function is cheap (map + linear scan per vessel bucket).
 *
 * @param seededEvents - Seeded timeline events for one sailing day (no mixed days)
 * @returns Function that returns `SegmentKey` when `ScheduledDepart` ms matches
 *   a seeded dep-dock row for that vessel, else `undefined`
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
