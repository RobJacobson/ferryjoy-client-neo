/**
 * Vessel orchestrator actions: one real-time tick as sequential steps (locations →
 * trips → predictions → timeline). Each step calls domain helpers then Convex
 * mutations; see {@link updateVesselOrchestrator} for the full pipeline.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters";
import { computeVesselTripsWithClock } from "domain/vesselOrchestration";
import {
  persistVesselTripsCompute,
  runUpdateVesselPredictions,
  runUpdateVesselTimeline,
} from "domain/vesselOrchestration/orchestratorTick";
import type { TripLifecycleApplyOutcome } from "domain/vesselOrchestration/updateTimeline";
import { createDefaultProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import {
  createScheduledSegmentLookup,
  createVesselOrchestratorConvexBindings,
} from "./utils";

/**
 * Builds trip-processing deps for the orchestrator: schedule lookups from Convex
 * queries plus default lifecycle builders.
 *
 * @param ctx - Action context used only to wire `runQuery` for scheduled events
 * @returns Dependency bag for {@link computeVesselTripsWithClock}
 */
const tripDepsForOrchestrator = (ctx: ActionCtx) =>
  createDefaultProcessVesselTripsDeps(createScheduledSegmentLookup(ctx));

/**
 * Internal action: load identity and active trips, fetch live locations, then run
 * locations → trips → predictions → timeline in order.
 *
 * @returns Nothing; logs and rethrows on failure
 * @throws When identity tables are empty, WSF fetch fails, or a mutation throws
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

      // Step 1: WSF fetch → Convex `vesselLocations` bulk upsert.
      const convexLocations = await updateVesselLocations(
        ctx,
        vesselsIdentity,
        terminalsIdentity
      );

      // Step 2: Trip compute + persist active/completed vessel trip rows.
      const { tripApplyResult, tickStartedAt } = await updateVesselTrips(
        ctx,
        convexLocations,
        activeTrips
      );

      // Step 3: Trip recompute for ML, prediction proposals upsert, ML overlay.
      const mlFull = await updateVesselPredictions(
        ctx,
        convexLocations,
        activeTrips,
        tickStartedAt
      );

      // Step 4: Timeline dock writes → `eventsActual` / `eventsPredicted`.
      await updateVesselTimeline(ctx, tripApplyResult, mlFull, tickStartedAt);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator]", err);
      throw err;
    }
  },
});

/**
 * Fetches live vessel locations from WSF and persists them via `bulkUpsert`.
 *
 * @param ctx - Convex action context for the location mutation
 * @param vesselsIdentity - Backend vessel rows for feed resolution
 * @param terminalsIdentity - Backend terminal rows for normalization
 * @returns Location rows written (or skipped as stale) by the mutation path
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  // Fetch latest vessel locations from WSF.
  const convexLocations = await fetchWsfVesselLocations(
    vesselsIdentity,
    terminalsIdentity
  );
  // Persist vessel locations to Convex.
  await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
    locations: convexLocations,
  });
  return convexLocations;
};

/**
 * Computes vessel trips for this tick and applies trip-table mutations
 * (handoffs, batch upsert, leave-dock follow-ups).
 *
 * @param ctx - Action context for Convex bindings
 * @param convexLocations - Live locations from {@link updateVesselLocations}
 * @param activeTrips - Preloaded active trip rows from the orchestrator snapshot
 * @returns Lifecycle apply outcome for timeline and wall-clock anchor for later
 *   steps
 */
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
 * Recomputes the trip branch with the same inputs as {@link updateVesselTrips},
 * builds ML overlay and prediction row proposals, and upserts proposals when
 * non-empty. Intentionally does not reuse trip-step outputs so this phase stays
 * isolated.
 *
 * @param ctx - Action context for bindings and proposal mutation
 * @param convexLocations - Same snapshot as the trips step
 * @param activeTrips - Same preloaded rows as the trips step
 * @param tickStartedAt - Clock anchor shared with the trips compute
 * @returns Full ML overlay (`TripLifecycleApplyOutcome`) for
 *   {@link updateVesselTimeline}
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
  const { proposals, mlFull } = await runUpdateVesselPredictions(
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

/**
 * Dock projection for this tick: delegates to domain {@link runUpdateVesselTimeline}
 * for merged lifecycle → mutation payloads, then runs `eventsActual` / `eventsPredicted`
 * when non-empty.
 *
 * @param ctx - Action context for timeline mutations
 * @param tripApplyResult - Outcome from {@link persistVesselTripsCompute}
 * @param mlFull - ML overlay from {@link updateVesselPredictions}
 * @param tickStartedAt - Wall-clock anchor for projection assembly
 * @returns Nothing
 */
export const updateVesselTimeline = async (
  ctx: ActionCtx,
  tripApplyResult: TripLifecycleApplyOutcome,
  mlFull: TripLifecycleApplyOutcome,
  tickStartedAt: number
): Promise<void> => {
  const { actual, predicted } = runUpdateVesselTimeline(
    tripApplyResult,
    mlFull,
    tickStartedAt
  );
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
