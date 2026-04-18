/**
 * Internal action: orchestrate one real-time vessel tick.
 *
 * Loads identity and active trips, fetches one WSF location batch via the adapter,
 * then runs {@link updateVesselLocations} → {@link updateVesselTrips} →
 * {@link updateVesselLocations} → {@link updateVesselPredictions} →
 * {@link updateVesselTimeline}.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import {
  computeOrchestratorTripTick,
  type OrchestratorTripTickOptions,
} from "domain/vesselOrchestration";
import {
  buildTripTickExecutionPayloads,
  completedFactsForSuccessfulHandoffs,
  materializePostTripTableWrites,
} from "domain/vesselOrchestration/orchestratorTick";
import type {
  TimelineTickProjectionInput,
  TripLifecycleApplyOutcome,
} from "domain/vesselOrchestration/updateTimeline";
import type {
  PendingLeaveDockEffect,
  ProcessVesselTripsDeps,
  VesselTripTick,
} from "domain/vesselOrchestration/updateVesselTrips";
import { createDefaultProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips";
import { createVesselTripPredictionModelAccess } from "functions/predictions/createVesselTripPredictionModelAccess";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTripWithPredictions,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";
import { createScheduledSegmentLookup } from "./orchestratorPipelines";

type UpsertBatchResult = {
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
};

export type VesselOrchestratorTickInput = {
  convexLocations: ReadonlyArray<ConvexVesselLocation>;
  activeTrips: ReadonlyArray<TickActiveTrip | ConvexVesselTripWithPredictions>;
  tripDeps: ProcessVesselTripsDeps;
  predictionModelAccess: VesselTripPredictionModelAccess;
};

export const updateVesselLocations = async (
  ctx: ActionCtx,
  convexLocations: ReadonlyArray<ConvexVesselLocation>
): Promise<void> => {
  if (convexLocations.length === 0) {
    return;
  }
  await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
    locations: convexLocations as ConvexVesselLocation[],
  });
};

export const updateVesselTrips = async (
  ctx: ActionCtx,
  input: Pick<
    VesselOrchestratorTickInput,
    "convexLocations" | "activeTrips" | "tripDeps"
  > & {
    /** Fixed tick clock for tests (see {@link computeOrchestratorTripTick}). */
    computeOptions?: OrchestratorTripTickOptions;
  }
): Promise<{
  tripApplyResult: TripLifecycleApplyOutcome;
  tickStartedAt: number;
}> => {
  const { vesselTripTick, tickStartedAt } = await computeOrchestratorTripTick(
    {
      convexLocations: input.convexLocations,
      activeTrips: input.activeTrips,
    },
    input.tripDeps,
    input.computeOptions
  );
  const tripApplyResult = await applyTripTickMutations(ctx, vesselTripTick);
  return { tripApplyResult, tickStartedAt };
};

export const updateVesselPredictions = async (
  ctx: ActionCtx,
  tripApplyResult: TripLifecycleApplyOutcome,
  predictionModelAccess: VesselTripPredictionModelAccess,
  tickStartedAt: number
): Promise<TimelineTickProjectionInput> => {
  const postTrip = await materializePostTripTableWrites(
    tripApplyResult,
    predictionModelAccess,
    tickStartedAt
  );
  if (postTrip.vesselTripPredictionsMutationArgs.proposals.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselTripPredictions.mutations.batchUpsertProposals,
      postTrip.vesselTripPredictionsMutationArgs
    );
  }
  return postTrip.timelineProjection;
};

export const updateVesselTimeline = async (
  ctx: ActionCtx,
  tl: TimelineTickProjectionInput
): Promise<void> => {
  if (tl.actualDockWrites.length > 0) {
    await ctx.runMutation(
      internal.functions.events.eventsActual.mutations.projectActualDockWrites,
      { Writes: tl.actualDockWrites }
    );
  }
  if (tl.predictedDockWriteBatches.length > 0) {
    await ctx.runMutation(
      internal.functions.events.eventsPredicted.mutations
        .projectPredictedDockWriteBatches,
      { Batches: tl.predictedDockWriteBatches }
    );
  }
};

/**
 * Handoff + active-trip mutations for one tick (strip + grouping from domain).
 * Used by {@link updateVesselTrips}; exported for focused unit tests.
 */
export const applyTripTickMutations = async (
  ctx: ActionCtx,
  tick: VesselTripTick
): Promise<TripLifecycleApplyOutcome> => {
  const payload = buildTripTickExecutionPayloads(tick);

  const settled = await Promise.allSettled(
    payload.handoffMutations.map((row) =>
      ctx.runMutation(
        api.functions.vesselTrips.mutations.completeAndStartNewTrip,
        {
          completedTrip: row.completedTrip,
          newTrip: row.newTrip,
        }
      )
    )
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const fact = tick.completedHandoffs[i];
    if (result?.status === "rejected" && fact !== undefined) {
      const err =
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason));
      const vesselAbbrev = fact.tripToComplete.VesselAbbrev;
      console.error(
        `[VesselTrips] Failed completed-trip processing for ${vesselAbbrev}: ${err.message}`,
        err
      );
    }
  }

  const completedFacts = completedFactsForSuccessfulHandoffs(tick, settled);

  let successfulVessels = new Set<string>();
  if (
    payload.activeUpsertBatch !== null &&
    payload.activeUpsertBatch.length > 0
  ) {
    successfulVessels = successfulVesselAbbrevsFromUpsert(
      await ctx.runMutation(
        api.functions.vesselTrips.mutations.upsertVesselTripsBatch,
        {
          activeUpserts: payload.activeUpsertBatch,
        }
      )
    );
  }

  await runLeaveDockPostPersistEffects(
    ctx,
    successfulVessels,
    payload.leaveDockEffects
  );

  return {
    completedFacts,
    currentBranch: {
      successfulVessels,
      pendingActualMessages: tick.current.pendingActualMessages,
      pendingPredictedMessages: tick.current.pendingPredictedMessages,
    },
  };
};

const successfulVesselAbbrevsFromUpsert = (
  upsertResult: UpsertBatchResult
): Set<string> =>
  new Set(
    upsertResult.perVessel
      .filter((result) => {
        if (result.ok) {
          return true;
        }

        console.error(
          `[VesselTrips] Failed active-trip upsert for ${result.vesselAbbrev}: ${
            result.reason ?? "unknown error"
          }`
        );
        return false;
      })
      .map((result) => result.vesselAbbrev)
  );

const runLeaveDockPostPersistEffects = async (
  ctx: ActionCtx,
  successfulVessels: Set<string>,
  pendingLeaveDockEffects: PendingLeaveDockEffect[]
): Promise<void> => {
  await Promise.allSettled(
    pendingLeaveDockEffects
      .filter((effect) => successfulVessels.has(effect.vesselAbbrev))
      .map(async (effect) => {
        try {
          const leftDockMs = effect.trip.LeftDockActual ?? effect.trip.LeftDock;
          if (leftDockMs === undefined) {
            return;
          }

          await ctx.runMutation(
            api.functions.vesselTrips.mutations
              .setDepartNextActualsForMostRecentCompletedTrip,
            {
              vesselAbbrev: effect.vesselAbbrev,
              actualDepartMs: leftDockMs,
            }
          );
        } catch (error) {
          console.error("[VesselTrips] leave-dock post-persist failed", {
            vesselAbbrev: effect.vesselAbbrev,
            trip: effect.trip,
            error,
          });
        }
      })
  );
};

const runOrchestratorTick = async (
  ctx: ActionCtx,
  input: VesselOrchestratorTickInput
): Promise<void> => {
  await updateVesselLocations(ctx, input.convexLocations);
  const { tripApplyResult, tickStartedAt } = await updateVesselTrips(ctx, {
    convexLocations: input.convexLocations,
    activeTrips: input.activeTrips,
    tripDeps: input.tripDeps,
  });
  await updateVesselLocations(ctx, input.convexLocations);
  const timelineProjection = await updateVesselPredictions(
    ctx,
    tripApplyResult,
    input.predictionModelAccess,
    tickStartedAt
  );
  await updateVesselTimeline(ctx, timelineProjection);
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

      await runOrchestratorTick(ctx, {
        convexLocations,
        activeTrips,
        tripDeps: createDefaultProcessVesselTripsDeps(
          createScheduledSegmentLookup(ctx)
        ),
        predictionModelAccess: createVesselTripPredictionModelAccess(ctx),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator]", err);
      throw err;
    }
  },
});
