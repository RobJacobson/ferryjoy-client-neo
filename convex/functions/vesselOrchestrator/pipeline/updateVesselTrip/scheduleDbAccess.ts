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
 * @param ctx - Convex action context used for internal schedule queries
 * @returns Scheduled-event read functions
 */
export const createScheduleDbAccess = (ctx: ActionCtx): ScheduleDbAccess => {
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
