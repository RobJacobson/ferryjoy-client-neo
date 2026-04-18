/**
 * Shared types for schedule-backed docked continuity (next-leg and rollover).
 */

/**
 * Provenance for which schedule continuity path selected the segment.
 */
export type DockedScheduledSegmentSource =
  | "completed_trip_next"
  | "rollover_schedule";
