/** Separator for `(vesselAbbrev, sailingDay)` composite keys (unlikely in abbrev strings). */
export const SCHEDULE_SNAPSHOT_COMPOSITE_SEP = "\u0000";

export const scheduleSnapshotCompositeKey = (
  vesselAbbrev: string,
  sailingDay: string
): string => `${vesselAbbrev}${SCHEDULE_SNAPSHOT_COMPOSITE_SEP}${sailingDay}`;
