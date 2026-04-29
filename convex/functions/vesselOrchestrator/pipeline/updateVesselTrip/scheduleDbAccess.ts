/**
 * Database helpers for scheduled event reads.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import type { UpdateVesselTripDbAccess } from "domain/vesselOrchestration/updateVesselTrip";

/**
 * Builds a minimal scheduled-events database accessor.
 *
 * Intentionally *does not* cache the results of the queries.
 *
 * @param ctx - Convex action context used for internal schedule queries
 * @returns Scheduled-event read functions
 */
export const createUpdateVesselTripDbAccess = (
  ctx: ActionCtx
): UpdateVesselTripDbAccess => {
  const getTerminalIdentity: UpdateVesselTripDbAccess["getTerminalIdentity"] =
    async (terminalAbbrev) =>
      ctx.runQuery(
        internal.functions.terminals.queries.getBackendTerminalByAbbrevInternal,
        {
          terminalAbbrev,
        }
      );

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
    getTerminalIdentity,
    getScheduledDockEvents,
    getScheduledDepartureEvent,
  };
};
