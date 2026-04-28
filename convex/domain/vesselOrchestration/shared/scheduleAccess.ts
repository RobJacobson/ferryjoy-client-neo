/**
 * Shared schedule-backed lookup contract for trip-field continuity.
 */

import type { ConvexScheduledDockEvent } from "domain/events/scheduled/schemas";

/**
 * Minimal database access contract for scheduled dock events.
 */
export type ScheduleDbAccess = {
  /**
   * Loads scheduled dock rows for one vessel on one sailing day.
   *
   * @param vesselAbbrev - Vessel abbreviation
   * @param sailingDay - Sailing day string (`YYYY-MM-DD`)
   * @returns Scheduled dock event rows for that vessel/day scope
   */
  getScheduledDockEvents: (
    vesselAbbrev: string,
    sailingDay: string
  ) => Promise<ReadonlyArray<ConvexScheduledDockEvent>>;
  /**
   * Loads one scheduled departure dock row by composite segment key.
   *
   * @param scheduleKey - Canonical segment key
   * @returns Matching departure dock row, or `null`
   */
  getScheduledDepartureEvent: (
    scheduleKey: string
  ) => Promise<ConvexScheduledDockEvent | null>;
};
