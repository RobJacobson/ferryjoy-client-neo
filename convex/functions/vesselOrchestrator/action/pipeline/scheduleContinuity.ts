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
import type { CompactScheduledDepartureEvent } from "domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes";

/**
 * Creates ping-scoped memoized access for schedule continuity lookups.
 *
 * This function provides the production implementation of the
 * `ScheduleContinuityAccess` interface consumed by trip-field inference in the
 * domain layer. It exists so trip logic can depend on a narrow schedule seam
 * while query policy and caching stay in the orchestrator function layer.
 * Memoization is scoped to one ping to avoid duplicate internal query work for
 * repeated vessel/day and segment-key lookups during the per-vessel loop.
 *
 * @param ctx - Convex action context used for internal schedule queries
 * @returns Schedule access adapter consumed by trip-stage logic
 */
export const createScheduleContinuityAccess = (
  ctx: ActionCtx
): ScheduleContinuityAccess => {
  const segmentCache = new Map<string, ConvexInferredScheduledSegment | null>();
  const departureCache = new Map<
    string,
    ReadonlyArray<CompactScheduledDepartureEvent>
  >();

  /**
   * Loads and caches compact departure rows for one vessel and sailing day.
   *
   * @param vesselAbbrev - Vessel abbreviation for schedule scope
   * @param sailingDay - Sailing day in backend canonical day format
   * @returns Sorted departure boundary rows for continuity decisions
   */
  const getScheduledDeparturesForVesselAndSailingDay = async (
    vesselAbbrev: string,
    sailingDay: string
  ): Promise<ReadonlyArray<CompactScheduledDepartureEvent>> => {
    const cacheKey = `${vesselAbbrev}:${sailingDay}`;
    const cached = departureCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const rows = await ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDockEventsForSailingDay,
      {
        vesselAbbrev,
        sailingDay,
      }
    );
    const departures = compactDeparturesFromScheduledRows(rows);
    departureCache.set(cacheKey, departures);
    return departures;
  };

  /**
   * Loads and caches one scheduled segment plus optional successor metadata.
   *
   * @param scheduleKey - Segment key derived from timeline boundary identity
   * @returns Inferred scheduled segment, or `null` when the key is unknown
   */
  const getScheduledSegmentByKey = async (
    scheduleKey: string
  ): Promise<ConvexInferredScheduledSegment | null> => {
    const cached = segmentCache.get(scheduleKey);
    if (cached !== undefined) {
      return cached;
    }

    const departureRow = await ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDepartureEventBySegmentKey,
      { segmentKey: scheduleKey }
    );

    if (!departureRow) {
      segmentCache.set(scheduleKey, null);
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

    const segment: ConvexInferredScheduledSegment = {
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
    segmentCache.set(scheduleKey, segment);
    return segment;
  };

  return {
    getScheduledDeparturesForVesselAndSailingDay,
    getScheduledSegmentByKey,
  };
};

/**
 * Converts schedule dock rows into sorted compact departure rows.
 *
 * @param rows - Scheduled dock rows for one vessel and sailing day
 * @returns Departure-only rows ordered for continuity lookups
 */
const compactDeparturesFromScheduledRows = (
  rows: ReadonlyArray<ConvexScheduledDockEvent>
): ReadonlyArray<CompactScheduledDepartureEvent> =>
  rows
    // Keep departure boundaries only; arrivals are not continuity anchors here.
    .filter((row) => row.EventType === "dep-dock")
    // Sort for stable "next departure" inference in successor resolution.
    .sort(
      (left, right) =>
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.TerminalAbbrev.localeCompare(right.TerminalAbbrev)
    )
    // Shrink row shape to the minimum fields continuity consumers require.
    .map((row) => ({
      Key: row.Key,
      ScheduledDeparture: row.ScheduledDeparture,
      TerminalAbbrev: row.TerminalAbbrev,
    }));
