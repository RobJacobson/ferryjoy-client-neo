/**
 * Targeted schedule-continuity access for the vessel orchestrator.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled";
import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import type { ScheduleContinuityAccess } from "domain/vesselOrchestration/shared";

/**
 * Creates schedule continuity access backed by live queries.
 *
 * This function provides the production implementation of the
 * `ScheduleContinuityAccess` interface consumed by trip-field inference in the
 * domain layer. It exists so trip logic can depend on a narrow schedule seam
 * while query policy stays in the orchestrator function layer.
 *
 * @param ctx - Convex action context used for internal schedule queries
 * @returns Schedule access adapter consumed by trip-stage logic
 */
export const createScheduleContinuityAccess = (
  ctx: ActionCtx
): ScheduleContinuityAccess => {
  /**
   * Loads departure rows for one vessel and sailing day.
   *
   * @param vesselAbbrev - Vessel abbreviation for schedule scope
   * @param sailingDay - Sailing day in backend canonical day format
   * @returns Sorted departure boundary rows for continuity decisions
   */
  const getScheduledDeparturesForVesselAndSailingDay = async (
    vesselAbbrev: string,
    sailingDay: string
  ): Promise<ReadonlyArray<ConvexScheduledDockEvent>> => {
    const rows = await ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDockEventsForSailingDay,
      {
        vesselAbbrev,
        sailingDay,
      }
    );
    return departuresFromScheduledRows(rows);
  };

  /**
   * Loads one scheduled segment plus optional successor metadata.
   *
   * @param scheduleKey - Segment key derived from timeline boundary identity
   * @returns Inferred scheduled segment, or `null` when the key is unknown
   */
  const getScheduledSegmentByKey = async (
    scheduleKey: string
  ): Promise<ConvexInferredScheduledSegment | null> => {
    const departureRow = await ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDepartureEventBySegmentKey,
      { segmentKey: scheduleKey }
    );

    if (!departureRow) {
      return null;
    }

    const departures = await getScheduledDeparturesForVesselAndSailingDay(
      departureRow.VesselAbbrev,
      departureRow.SailingDay
    );
    const departureIndex = departures.findIndex(
      (departure) => departure.Key === departureRow.Key
    );
    const nextDeparture =
      departureIndex >= 0 ? departures[departureIndex + 1] : undefined;

    return {
      Key: scheduleKey,
      SailingDay: departureRow.SailingDay,
      DepartingTerminalAbbrev: departureRow.TerminalAbbrev,
      ArrivingTerminalAbbrev: departureRow.NextTerminalAbbrev,
      DepartingTime: departureRow.ScheduledDeparture,
      NextKey: nextDeparture
        ? getSegmentKeyFromBoundaryKey(nextDeparture.Key)
        : undefined,
      NextDepartingTime: nextDeparture?.ScheduledDeparture,
    };
  };

  return {
    getScheduledDeparturesForVesselAndSailingDay,
    getScheduledSegmentByKey,
  };
};

/**
 * Returns sorted departure rows for continuity lookups.
 *
 * @param rows - Scheduled dock rows for one vessel and sailing day
 * @returns Departure rows ordered for continuity lookups
 */
const departuresFromScheduledRows = (
  rows: ReadonlyArray<ConvexScheduledDockEvent>
): ReadonlyArray<ConvexScheduledDockEvent> =>
  rows
    // Keep departure boundaries only; arrivals are not continuity anchors here.
    .filter((row) => row.EventType === "dep-dock")
    // Sort for stable "next departure" inference in successor resolution.
    .sort(
      (left, right) =>
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.TerminalAbbrev.localeCompare(right.TerminalAbbrev)
    );
