/**
 * Internal action: orchestrate one real-time vessel tick.
 *
 * Loads identity and active trips, fetches one WSF location batch via the adapter,
 * then applies DB writes in order: locations, trip lifecycle, timeline projection.
 */

import { api, internal } from "_generated/api";
import { type ActionCtx, internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters";
import { computeVesselOrchestratorTripTickWrites } from "domain/vesselOrchestration";
import { buildTimelineTickProjectionInput } from "domain/vesselOrchestration/updateTimeline";
import { bulkUpsertArgsFromConvexLocations } from "domain/vesselOrchestration/updateVesselLocations";
import {
  createDefaultProcessVesselTripsDeps,
  type ScheduledSegmentLookup,
  type TimelineTickProjectionInput,
} from "domain/vesselOrchestration/updateVesselTrips";
import { createVesselTripPredictionModelAccess } from "functions/predictions/createVesselTripPredictionModelAccess";
import { applyVesselTripTickWritePlan } from "functions/vesselTrips/applyVesselTripTickWritePlan";

/**
 * Schedule lookup backed by internal `eventsScheduled` queries for vessel trip
 * ticks (`createDefaultProcessVesselTripsDeps`).
 *
 * @param ctx - Convex action context for query execution
 * @returns Lookup callbacks for scheduled departure and dock events
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
 * Applies sparse `eventsActual` / `eventsPredicted` writes for one tick.
 *
 * @param ctx - Convex action context
 * @param writes - Timeline projection payload from domain assembly
 */
const applyTimelineTickProjectionWrites = async (
  ctx: ActionCtx,
  writes: TimelineTickProjectionInput
): Promise<void> => {
  await Promise.all([
    writes.actualDockWrites.length > 0
      ? ctx.runMutation(
          internal.functions.events.eventsActual.mutations
            .projectActualDockWrites,
          {
            Writes: writes.actualDockWrites,
          }
        )
      : Promise.resolve(),
    writes.predictedDockWriteBatches.length > 0
      ? ctx.runMutation(
          internal.functions.events.eventsPredicted.mutations
            .projectPredictedDockWriteBatches,
          {
            Batches: writes.predictedDockWriteBatches,
          }
        )
      : Promise.resolve(),
  ]);
};

/**
 * Query read model, fetch WSF locations, run sequential tick writes.
 *
 * @param ctx - Convex action context
 * @throws If identity tables are empty, WSF fetch fails, or a mutation throws
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    try {
      // Load denormalized vessels/terminals/active trips in one query for the tick.
      const snapshot = await ctx.runQuery(
        internal.functions.vesselOrchestrator.queries.getOrchestratorModelData
      );
      if (
        snapshot.vesselsIdentity.length === 0 ||
        snapshot.terminalsIdentity.length === 0
      ) {
        throw new Error(
          "vesselsIdentity or terminalsIdentity empty; skipping tick."
        );
      }

      const { vesselsIdentity, terminalsIdentity, activeTrips } = snapshot;

      // Fetch one WSF batch; feeds both location upsert and trip computation.
      const convexLocations = await fetchWsfVesselLocations(
        vesselsIdentity,
        terminalsIdentity
      );

      // Wire schedule lookups + prediction reads on this ctx for `buildTrip` paths.
      const tripDeps = createDefaultProcessVesselTripsDeps(
        createScheduledSegmentLookup(ctx),
        createVesselTripPredictionModelAccess(ctx)
      );

      // Compute gated trip writes + tick anchor before any lifecycle mutations run.
      const { tripWrites, tickStartedAt } =
        await computeVesselOrchestratorTripTickWrites(
          {
            convexLocations,
            terminalsIdentity,
            activeTrips,
          },
          tripDeps
        );

      // Upsert live positions; may run before/after trips without breaking invariants.
      await ctx.runMutation(
        api.functions.vesselLocation.mutations.bulkUpsert,
        bulkUpsertArgsFromConvexLocations(convexLocations)
      );

      // Apply lifecycle mutations; surface boundary facts the timeline merge needs.
      const applyTripResult = await applyVesselTripTickWritePlan(
        ctx,
        tripWrites
      );

      // Merge apply results into sparse actual/predicted payloads (success-sensitive).
      const timelineWrites = buildTimelineTickProjectionInput({
        completedFacts: applyTripResult.completedFacts,
        currentBranch: applyTripResult.currentBranch,
        tickStartedAt,
      });

      // Project merged rows onto `eventsActual` / `eventsPredicted`.
      await applyTimelineTickProjectionWrites(ctx, timelineWrites);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator]", err);
      throw err;
    }
  },
});
