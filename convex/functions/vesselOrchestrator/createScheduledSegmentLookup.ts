/**
 * Schedule lookup backed by internal `eventsScheduled` queries for vessel trip
 * ticks (`createDefaultProcessVesselTripsDeps`).
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/updateVesselTrips";

/**
 * Builds schedule lookup callbacks for docked continuity and schedule
 * enrichment during trip processing.
 *
 * @param ctx - Convex action context for query execution
 * @returns Lookup callbacks for scheduled departure and dock events
 */
export const createScheduledSegmentLookup = (
  ctx: ActionCtx
): ScheduledSegmentLookup => ({
  getScheduledDepartureEventBySegmentKey: (segmentKey: string) =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDepartureEventBySegmentKey,
      { segmentKey }
    ),
  getScheduledDockEventsForSailingDay: (args: {
    vesselAbbrev: string;
    sailingDay: string;
  }) =>
    ctx.runQuery(
      internal.functions.events.eventsScheduled.queries
        .getScheduledDockEventsForSailingDay,
      args
    ),
});
