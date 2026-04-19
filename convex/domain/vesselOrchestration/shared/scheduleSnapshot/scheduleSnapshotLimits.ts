/**
 * Hard caps for schedule snapshot bulk loads (orchestrator tick).
 * Keep aligned with {@link getScheduleSnapshotForTick} validators and handler checks.
 */
export const MAX_SCHEDULE_SNAPSHOT_VESSEL_ABBREVS = 64;
export const MAX_SCHEDULE_SNAPSHOT_SAILING_DAYS = 5;
export const MAX_SCHEDULE_SNAPSHOT_SEGMENT_KEYS = 256;
export const MAX_SCHEDULE_SNAPSHOT_VESSEL_SAILING_PAIRS = 320;
