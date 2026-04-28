/**
 * Database helpers for scheduled event reads.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import type { ScheduleDbAccess } from "domain/vesselOrchestration/shared";

/**
 * Builds a minimal scheduled-events database accessor.
 *
 * This helper stays in the Convex function layer and only issues database
 * reads. It does not perform business-level schedule inference.
 *
 * @param ctx - Convex action context used for internal schedule queries
 * @returns Scheduled-event read functions
 */
export const createScheduleDbAccess = (ctx: ActionCtx): ScheduleDbAccess => {
  /**
   * Loads scheduled dock rows for one vessel and sailing day.
   *
   * @param vesselAbbrev - Vessel abbreviation
   * @param sailingDay - Sailing day in backend canonical day format
   * @returns Scheduled dock event rows for that vessel/day scope
   */
  const getScheduledDockEvents = async (
    vesselAbbrev: string,
    sailingDay: string
  ): Promise<ReadonlyArray<ConvexScheduledDockEvent>> => {
    return ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDockEventsForSailingDay,
      {
        vesselAbbrev,
        sailingDay,
      }
    );
  };

  /**
   * Loads one scheduled departure dock row by segment key.
   *
   * @param scheduleKey - Segment key derived from timeline boundary identity
   * @returns Scheduled departure row, or `null` when unknown
   */
  const getScheduledDepartureEvent = async (
    scheduleKey: string
  ): Promise<ConvexScheduledDockEvent | null> =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDepartureEventBySegmentKey,
      { segmentKey: scheduleKey }
    );

  return {
    getScheduledDockEvents,
    getScheduledDepartureEvent,
  };
};
