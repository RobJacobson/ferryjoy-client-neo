/**
 * Factory for {@link VesselOrchestratorTickDeps}: closes Convex I/O over
 * `ActionCtx` for `runVesselOrchestratorTick`.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { VesselOrchestratorTickDeps } from "domain/vesselOrchestration/types";
import { runUpdateVesselLocationsTick } from "domain/vesselOrchestration/updateVesselLocations/runUpdateVesselLocationsTick";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createDefaultProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips/processTick/defaultProcessVesselTripsDeps";
import { processVesselTripsWithDeps } from "domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips";
import { createVesselTripPredictionModelAccess } from "functions/predictions/createVesselTripPredictionModelAccess";
import { applyTickEventWrites } from "./applyTickEventWrites";

/**
 * Schedule lookup callbacks backed by internal `eventsScheduled` queries.
 * Feeds {@link createDefaultProcessVesselTripsDeps} for trip ticks.
 *
 * @param ctx - Convex action context for query execution
 * @returns Lookup callbacks for docked continuity and schedule enrichment
 */
const createScheduledSegmentLookup = (
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
 * Builds injected adapters for one orchestrator action invocation: bulk
 * locations, trip lifecycle + predictions, then timeline writes.
 *
 * Four concerns (`architecture.md` §10): **updateVesselLocations**,
 * **updateVesselTrips** (includes **updateVesselPredictions** on the build
 * path), **updateTimeline**.
 *
 * @param ctx - Convex action context (`runMutation` / `runQuery`)
 * @returns Deps for {@link runVesselOrchestratorTick}
 */
export const createVesselOrchestratorTickDeps = (
  ctx: ActionCtx
): VesselOrchestratorTickDeps => {
  const processVesselTripsDeps = createDefaultProcessVesselTripsDeps(
    createScheduledSegmentLookup(ctx),
    createVesselTripPredictionModelAccess(ctx)
  );

  return {
    persistLocations: (locations) =>
      runUpdateVesselLocationsTick(locations, (args) =>
        ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, args)
      ),
    processVesselTrips: (locations, tickStartedAt, activeTrips, options) =>
      processVesselTripsWithDeps(
        ctx,
        locations,
        tickStartedAt,
        processVesselTripsDeps,
        activeTrips,
        options
      ),
    applyTickEventWrites: (writes) => applyTickEventWrites(ctx, writes),
  };
};
