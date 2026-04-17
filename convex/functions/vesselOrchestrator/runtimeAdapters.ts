/**
 * Functions-layer runtime wiring for vessel trip processing dependencies.
 *
 * Owns Convex runtime references (`ActionCtx`, internal query refs, `runQuery`)
 * and injects lookup callbacks into domain-level adapter builders.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createBuildTripRuntimeAdapters } from "domain/vesselOrchestration/updateVesselTrips/processTick/buildTripRuntimeAdapters";
import type { ProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips";
import { buildCompletedTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";

/**
 * Build schedule lookup callbacks backed by internal `eventsScheduled` queries.
 *
 * @param ctx - Convex action context for query execution
 * @returns Lookup callbacks used by docked continuity and schedule enrichment
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

/**
 * Build the production dependency bag for `processVesselTripsWithDeps`.
 *
 * @param ctx - Convex action context
 * @returns Fully wired lifecycle dependencies for orchestrator ticks
 */
export const createDefaultProcessVesselTripsDeps = (
  ctx: ActionCtx
): ProcessVesselTripsDeps => ({
  buildCompletedTrip,
  buildTrip,
  detectTripEvents,
  buildTripAdapters: createBuildTripRuntimeAdapters(
    createScheduledSegmentLookup(ctx)
  ),
});
