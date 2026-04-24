/**
 * Targeted schedule-continuity access for the vessel orchestrator.
 *
 * This keeps the ping-time `eventsScheduled` lookup policy in a dedicated
 * runtime module so the main action can stay focused on high-level flow.
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
 * Creates memoized targeted schedule access for the current ping.
 *
 * @param ctx - Action context for `eventsScheduled` queries
 * @returns Cached schedule continuity access
 */
export const createScheduleContinuityAccess = (
  ctx: ActionCtx
): ScheduleContinuityAccess => {
  const segmentCache = new Map<
    string,
    Promise<ConvexInferredScheduledSegment | null>
  >();
  const departureCache = new Map<
    string,
    Promise<ReadonlyArray<CompactScheduledDepartureEvent>>
  >();

  const getScheduledDeparturesForVesselAndSailingDay = async (
    vesselAbbrev: string,
    sailingDay: string
  ): Promise<ReadonlyArray<CompactScheduledDepartureEvent>> => {
    const cacheKey = `${vesselAbbrev}:${sailingDay}`;
    const cached = departureCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = ctx
      .runQuery(
        internal.functions.events.eventsScheduled.queries
          .getScheduledDockEventsForSailingDay,
        {
          vesselAbbrev,
          sailingDay,
        }
      )
      .then(compactDeparturesFromScheduledRows);
    departureCache.set(cacheKey, promise);
    return promise;
  };

  return {
    getScheduledDeparturesForVesselAndSailingDay,
    getScheduledSegmentByKey: async (
      scheduleKey: string
    ): Promise<ConvexInferredScheduledSegment | null> => {
      const cached = segmentCache.get(scheduleKey);
      if (cached) {
        return cached;
      }

      const promise = ctx
        .runQuery(
          internal.functions.events.eventsScheduled.queries
            .getScheduledDepartureEventBySegmentKey,
          { segmentKey: scheduleKey }
        )
        .then(async (departureRow) => {
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
        });
      segmentCache.set(scheduleKey, promise);
      return promise;
    },
  };
};

/**
 * Narrows scheduled dock rows to ordered departure summaries.
 *
 * @param rows - Scheduled dock rows for one vessel and sailing day
 * @returns Sorted departure-only rows used for continuity lookups
 */
const compactDeparturesFromScheduledRows = (
  rows: ReadonlyArray<ConvexScheduledDockEvent>
): ReadonlyArray<CompactScheduledDepartureEvent> =>
  rows
    .filter((row) => row.EventType === "dep-dock")
    .sort(
      (left, right) =>
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.TerminalAbbrev.localeCompare(right.TerminalAbbrev)
    )
    .map((row) => ({
      Key: row.Key,
      ScheduledDeparture: row.ScheduledDeparture,
      TerminalAbbrev: row.TerminalAbbrev,
    }));
