/**
 * Vessel orchestrator actions: one real-time tick as sequential steps (locations →
 * trips → predictions → timeline). Each step calls domain helpers then Convex
 * mutations; see {@link updateVesselOrchestrator} for the full pipeline.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import {
  buildScheduleSnapshotQueryArgs,
  createScheduledSegmentLookupFromSnapshot,
  type TripLifecycleApplyOutcome,
  type VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
import { runUpdateVesselTimeline } from "domain/vesselOrchestration/updateTimeline";
import { runUpdateVesselLocations } from "domain/vesselOrchestration/updateVesselLocations";
import { runUpdateVesselPredictions } from "domain/vesselOrchestration/updateVesselPredictions";
import {
  computeVesselTripsWithClock,
  createDefaultProcessVesselTripsDeps,
  type ProcessVesselTripsDeps,
} from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import { persistVesselTripWriteSet } from "./persistVesselTripWriteSet";
import { createVesselOrchestratorConvexBindings } from "./utils";

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

      // One wall-clock anchor for this entire orchestrator run (locations → trips →
      // predictions → timeline). Sub-minute policy (e.g. prediction fallback) keys off
      // this instant—not "start of trip compute after WSF fetch."
      const tickStartedAt = Date.now();

      // Step 1: WSF fetch → Convex `vesselLocations` bulk upsert.
      const convexLocations = await updateVesselLocations(
        ctx,
        tickStartedAt,
        vesselsIdentity,
        terminalsIdentity
      );

      const scheduleSnapshotQueryStartedAt = Date.now();
      const scheduleQueryArgs = buildScheduleSnapshotQueryArgs(
        vesselsIdentity,
        activeTrips,
        convexLocations,
        tickStartedAt
      );
      const scheduleSnapshot = await ctx.runQuery(
        internal.functions.vesselOrchestrator.queries
          .getScheduleSnapshotForTick,
        scheduleQueryArgs
      );
      const scheduleSnapshotQueryMs =
        Date.now() - scheduleSnapshotQueryStartedAt;
      const snapshotJsonSize = JSON.stringify(scheduleSnapshot).length;
      const SNAPSHOT_LOG_MAX_BYTES = 400_000;
      if (snapshotJsonSize <= SNAPSHOT_LOG_MAX_BYTES) {
        console.log(
          `[updateVesselOrchestrator] scheduleSnapshot bytes=${snapshotJsonSize} durationMs=${scheduleSnapshotQueryMs}`
        );
      } else {
        console.log(
          `[updateVesselOrchestrator] scheduleSnapshot bytes=(omitted,>${SNAPSHOT_LOG_MAX_BYTES}) durationMs=${scheduleSnapshotQueryMs}`
        );
      }

      const tripProcessDeps: ProcessVesselTripsDeps =
        createDefaultProcessVesselTripsDeps(
          createScheduledSegmentLookupFromSnapshot(scheduleSnapshot)
        );

      // Step 2: Trip compute + persist active/completed vessel trip rows.
      const { tripApplyResult } = await updateVesselTrips(
        ctx,
        convexLocations,
        activeTrips,
        tickStartedAt,
        tripProcessDeps
      );

      // Step 3: Trip recompute for ML, prediction proposals upsert, ML overlay.
      const mlFull = await updateVesselPredictions(
        ctx,
        convexLocations,
        activeTrips,
        tickStartedAt,
        tripProcessDeps
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
 * @param tickStartedAt - Orchestrator-owned tick anchor shared with the domain runner
 * @param vesselsIdentity - Backend vessel rows for feed resolution
 * @param terminalsIdentity - Backend terminal rows for normalization
 * @returns Location rows written (or skipped as stale) by the mutation path
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  tickStartedAt: number,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  const { vesselLocations: convexLocations } = await runUpdateVesselLocations({
    tickStartedAt,
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity,
  });

  // Persist vessel locations to Convex.
  await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
    locations: convexLocations,
  });
  return convexLocations;
};

/**
 * Computes vessel trips for this tick and applies trip-table mutations
 * (handoffs, batch upsert, leave-dock follow-ups) via {@link persistVesselTripWriteSet}.
 *
 * @param ctx - Action context for Convex bindings
 * @param convexLocations - Live locations from {@link updateVesselLocations}
 * @param activeTrips - Preloaded active trip rows from the orchestrator snapshot
 * @param tickStartedAt - Orchestrator-owned tick anchor (same value as predictions/timeline)
 * @param tripDeps - Shared trip compute deps (same snapshot-backed schedule lookup as predictions)
 * @returns Persist-scoped trip tick outcome (alias-compatible with timeline types)
 */
export const updateVesselTrips = async (
  ctx: ActionCtx,
  convexLocations: ReadonlyArray<ConvexVesselLocation>,
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  tickStartedAt: number,
  tripDeps: ProcessVesselTripsDeps
): Promise<{
  tripApplyResult: VesselTripPersistResult;
}> => {
  const bindings = createVesselOrchestratorConvexBindings(ctx);
  const { tripsCompute } = await computeVesselTripsWithClock(
    { convexLocations, activeTrips },
    tripDeps,
    { tickStartedAt }
  );
  const tripApplyResult = await persistVesselTripWriteSet(
    tripsCompute,
    bindings.vesselTripMutations
  );
  return { tripApplyResult };
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
 * @param tripDeps - Same {@link ProcessVesselTripsDeps} as {@link updateVesselTrips}
 * @returns Full ML overlay (`TripLifecycleApplyOutcome`) for
 *   {@link updateVesselTimeline}
 */
export const updateVesselPredictions = async (
  ctx: ActionCtx,
  convexLocations: ReadonlyArray<ConvexVesselLocation>,
  activeTrips: ReadonlyArray<
    ConvexVesselTrip | ConvexVesselTripWithPredictions
  >,
  tickStartedAt: number,
  tripDeps: ProcessVesselTripsDeps
): Promise<TripLifecycleApplyOutcome> => {
  const bindings = createVesselOrchestratorConvexBindings(ctx);
  const { tripsCompute } = await computeVesselTripsWithClock(
    { convexLocations, activeTrips },
    tripDeps,
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
 * @param tripApplyResult - Outcome from {@link persistVesselTripWriteSet}
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
