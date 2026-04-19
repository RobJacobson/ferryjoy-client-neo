/**
 * Internal action: orchestrate one real-time vessel tick.
 *
 * Loads identity and active trips, fetches one WSF location batch via the adapter,
 * then runs `vesselLocation` bulk upsert → {@link updateVesselTrips} →
 * {@link updateVesselPredictions} → {@link updateVesselTimeline}.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters";
import { computeVesselTripsWithClock } from "domain/vesselOrchestration";
import {
  buildOrchestratorTimelineProjectionInput,
  buildVesselTripPredictionWrites,
  persistVesselTripsCompute,
} from "domain/vesselOrchestration/orchestratorTick";
import {
  type TripLifecycleApplyOutcome,
  timelineDockWriteMutationArgs,
} from "domain/vesselOrchestration/updateTimeline";
import { createDefaultProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import {
  createScheduledSegmentLookup,
  createVesselOrchestratorConvexBindings,
} from "./vesselOrchestratorConvexBindings";

const tripDepsForOrchestrator = (ctx: ActionCtx) =>
  createDefaultProcessVesselTripsDeps(createScheduledSegmentLookup(ctx));

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

      const convexLocations = await fetchWsfVesselLocations(
        vesselsIdentity,
        terminalsIdentity
      );

      await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
        locations: [...convexLocations],
      });

      const { tripApplyResult, tickStartedAt } = await updateVesselTrips(
        ctx,
        convexLocations,
        activeTrips
      );

      const mlFull = await updateVesselPredictions(
        ctx,
        convexLocations,
        activeTrips,
        tickStartedAt
      );

      await updateVesselTimeline(ctx, tripApplyResult, mlFull, tickStartedAt);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator]", err);
      throw err;
    }
  },
});

export const updateVesselTrips = async (
  ctx: ActionCtx,
  convexLocations: ReadonlyArray<ConvexVesselLocation>,
  activeTrips: ReadonlyArray<ConvexVesselTrip>
): Promise<{
  tripApplyResult: TripLifecycleApplyOutcome;
  tickStartedAt: number;
}> => {
  const bindings = createVesselOrchestratorConvexBindings(ctx);
  const { tripsCompute, tickStartedAt } = await computeVesselTripsWithClock(
    { convexLocations, activeTrips },
    tripDepsForOrchestrator(ctx),
    undefined
  );
  const tripApplyResult = await persistVesselTripsCompute(
    tripsCompute,
    bindings.vesselTripMutations
  );
  return { tripApplyResult, tickStartedAt };
};

/**
 * Every tick: recompute trip branch from locations + active trips, ask domain for prediction
 * write payload (proposals + ML overlay), persist proposals when non-empty.
 * Does not consume {@link updateVesselTrips} outputs — only the same vessel-trip inputs.
 * (Trip compute is intentionally run again so this step stays isolated from trip persistence.)
 *
 * @returns ML overlay for the full computed tick; pass to {@link updateVesselTimeline}.
 */
export const updateVesselPredictions = async (
  ctx: ActionCtx,
  convexLocations: ReadonlyArray<ConvexVesselLocation>,
  activeTrips: ReadonlyArray<
    ConvexVesselTrip | ConvexVesselTripWithPredictions
  >,
  tickStartedAt: number
): Promise<TripLifecycleApplyOutcome> => {
  const bindings = createVesselOrchestratorConvexBindings(ctx);
  const { tripsCompute } = await computeVesselTripsWithClock(
    { convexLocations, activeTrips },
    tripDepsForOrchestrator(ctx),
    { tickStartedAt }
  );
  const { proposals, mlFull } = await buildVesselTripPredictionWrites(
    tripsCompute,
    bindings.predictionModelQueries
  );
  if (proposals.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselTripPredictions.mutations.batchUpsertProposals,
      { proposals }
    );
  }
  return mlFull;
};

export const updateVesselTimeline = async (
  ctx: ActionCtx,
  tripApplyResult: TripLifecycleApplyOutcome,
  mlFull: TripLifecycleApplyOutcome,
  tickStartedAt: number
): Promise<void> => {
  const tl = buildOrchestratorTimelineProjectionInput(
    tripApplyResult,
    mlFull,
    tickStartedAt
  );
  const { actual, predicted } = timelineDockWriteMutationArgs(tl);
  if (actual.Writes.length > 0) {
    await ctx.runMutation(
      internal.functions.events.eventsActual.mutations.projectActualDockWrites,
      actual
    );
  }
  if (predicted.Batches.length > 0) {
    await ctx.runMutation(
      internal.functions.events.eventsPredicted.mutations
        .projectPredictedDockWriteBatches,
      predicted
    );
  }
};
