/**
 * Database helpers for vessel trip data reads.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexScheduledDockEvent } from "domain/events/scheduled";
import type { UpdateVesselTripDbAccess } from "domain/vesselOrchestration/updateVesselTrip";

/**
 * Builds a minimal database accessor for updateVesselTrip.
 *
 * Intentionally *does not* cache the results of the queries.
 *
 * @param ctx - Convex action context used for internal schedule queries
 * @returns Scheduled-event read functions
 */
export const createUpdateVesselTripDbAccess = (
  ctx: ActionCtx
): UpdateVesselTripDbAccess => {
  /**
   * Loads terminal identity by abbreviation via `getBackendTerminalByAbbrevInternal`.
   *
   * @param terminalAbbrev - Terminal abbreviation from the live location row
   * @returns Matching terminal identity row, or `null`
   */
  const getTerminalIdentity: UpdateVesselTripDbAccess["getTerminalIdentity"] =
    async (terminalAbbrev) =>
      ctx.runQuery(
        internal.functions.terminals.queries.getBackendTerminalByAbbrevInternal,
        {
          terminalAbbrev,
        }
      );

  /**
   * Loads scheduled dock rows for one vessel on one sailing day via
   * `getScheduledDockEventsForSailingDay`.
   *
   * @param vesselAbbrev - Vessel abbreviation
   * @param sailingDay - Sailing day string (`YYYY-MM-DD`)
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
   * Loads one scheduled departure dock row by segment key via
   * `getScheduledDepartureEventBySegmentKey`.
   *
   * @param scheduleKey - Canonical segment key
   * @returns Matching departure dock row, or `null`
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
    getTerminalIdentity,
    getScheduledDockEvents,
    getScheduledDepartureEvent,
  };
};
