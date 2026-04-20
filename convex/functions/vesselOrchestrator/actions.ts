/**
 * Vessel orchestrator actions: one real-time tick as sequential steps (locations →
 * trips → predictions → timeline). Each step calls domain helpers then Convex
 * mutations; see {@link updateVesselOrchestrator} for the full pipeline.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/shared";
import {
  buildScheduleSnapshotQueryArgs,
  type ScheduleSnapshot,
  type VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
import {
  assembleTripComputationsFromBundle,
  type RunUpdateVesselTimelineInput,
  runUpdateVesselTimeline,
} from "domain/vesselOrchestration/updateTimeline";
import { runUpdateVesselLocations } from "domain/vesselOrchestration/updateVesselLocations";
import {
  type PredictedTripComputation,
  predictionModelTypesForTrip,
  runUpdateVesselPredictions,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import {
  computeUpdateVesselTripsTickArtifacts,
  type RunUpdateVesselTripsOutput,
  type TripComputation,
  type VesselTripsComputeBundle,
} from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildTimelineTripComputationsForRun } from "./buildTimelineTripComputationsForRun";
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

      // Step 2: Trip compute + persist active/completed vessel trip rows.
      const { trips, tripsCompute, tripApplyResult, tripComputations } =
        await updateVesselTrips(
          ctx,
          convexLocations,
          activeTrips,
          tickStartedAt,
          scheduleSnapshot
        );

      // Step 3: Canonical prediction compute over trip handoff data.
      const { predictedTripComputations } = await updateVesselPredictions(
        ctx,
        trips,
        tripsCompute.completedHandoffs
      );

      // Step 4: Timeline dock writes → `eventsActual` / `eventsPredicted`.
      await updateVesselTimeline(ctx, {
        tickStartedAt,
        tripComputations: buildTimelineTripComputationsForRun(
          trips,
          tripComputations,
          tripApplyResult
        ),
        predictedTripComputations,
      });
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
 * @param _tickStartedAt - Orchestrator tick anchor (shared with predictions/timeline). Unused by
 *   the trips domain runner after Phase B — retained for a stable orchestrator call signature.
 * @param scheduleContext - Plain-data schedule snapshot for this tick
 * @returns Persist-scoped trip tick outcome (alias-compatible with timeline types)
 */
export const updateVesselTrips = async (
  ctx: ActionCtx,
  convexLocations: ReadonlyArray<ConvexVesselLocation>,
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  _tickStartedAt: number,
  scheduleContext: ScheduleSnapshot
): Promise<{
  trips: RunUpdateVesselTripsOutput;
  tripsCompute: VesselTripsComputeBundle;
  tripApplyResult: VesselTripPersistResult;
  tripComputations: ReadonlyArray<TripComputation>;
}> => {
  const bindings = createVesselOrchestratorConvexBindings(ctx);
  const tickArtifacts = await computeUpdateVesselTripsTickArtifacts({
    vesselLocations: convexLocations,
    existingActiveTrips: activeTrips,
    scheduleContext,
  });
  const tripApplyResult = await persistVesselTripWriteSet(
    tickArtifacts.trips,
    tickArtifacts.bundle,
    bindings.vesselTripMutations
  );
  return {
    trips: tickArtifacts.trips,
    tripsCompute: tickArtifacts.bundle,
    tripApplyResult,
    tripComputations: assembleTripComputationsFromBundle(tickArtifacts.bundle),
  };
};

/**
 * Preloads the minimal model context required for this tick, computes
 * predictions from canonical trip handoff data, and persists proposals when
 * non-empty.
 *
 * @param ctx - Action context for preload and proposal mutation
 * @param trips - Current tick trip rows
 * @param completedHandoffs - Completed-trip rollover pairings for replacement-trip predictions
 * @returns Canonical Stage D prediction outputs
 */
export const updateVesselPredictions = async (
  ctx: ActionCtx,
  trips: RunUpdateVesselTripsOutput,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): Promise<{
  vesselTripPredictions: ReadonlyArray<
    Awaited<
      ReturnType<typeof runUpdateVesselPredictions>
    >["vesselTripPredictions"][number]
  >;
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>;
}> => {
  const predictionContext = await loadPredictionContext(
    ctx,
    trips.activeTrips,
    completedHandoffs
  );
  const predictions = await runUpdateVesselPredictions({
    activeTrips: trips.activeTrips,
    completedHandoffs,
    predictionContext,
  });
  if (predictions.vesselTripPredictions.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselTripPredictions.mutations.batchUpsertProposals,
      { proposals: [...predictions.vesselTripPredictions] }
    );
  }
  return predictions;
};

const buildPredictionContextRequests = (
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): Array<{ pairKey: string; modelTypes: ModelType[] }> => {
  const requestMap = new Map<string, Set<ModelType>>();

  const tripsToPredict = [
    ...completedHandoffs.map((handoff) => handoff.newTripCore.withFinalSchedule),
    ...activeTrips,
  ];

  for (const trip of tripsToPredict) {
    const modelTypesForTrip = predictionModelTypesForTrip(trip);
    if (modelTypesForTrip.length === 0) {
      continue;
    }

    const departing = trip.DepartingTerminalAbbrev;
    const arriving = trip.ArrivingTerminalAbbrev;
    if (departing === undefined || arriving === undefined) {
      continue;
    }

    const pairKey = formatTerminalPairKey(departing, arriving);
    const modelTypes = requestMap.get(pairKey) ?? new Set<ModelType>();
    for (const modelType of modelTypesForTrip) {
      modelTypes.add(modelType);
    }

    if (modelTypes.size > 0) {
      requestMap.set(pairKey, modelTypes);
    }
  }

  return [...requestMap.entries()].map(([pairKey, modelTypes]) => ({
    pairKey,
    modelTypes: [...modelTypes],
  }));
};

const loadPredictionContext = async (
  ctx: ActionCtx,
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): Promise<VesselPredictionContext> => {
  const requests = buildPredictionContextRequests(activeTrips, completedHandoffs);
  if (requests.length === 0) {
    return {};
  }

  const productionModelsByPair = await ctx.runQuery(
    internal.functions.predictions.queries.getProductionModelParametersForTick,
    { requests }
  );
  return { productionModelsByPair };
};

/**
 * Dock projection for this tick: calls domain {@link runUpdateVesselTimeline} with
 * the same {@link RunUpdateVesselTimelineInput} shape the PRD specifies (orchestrator
 * builds {@link TimelineTripComputation} rows via
 * {@link buildTimelineTripComputationsForRun} after persist).
 *
 * @param ctx - Action context for timeline mutations
 * @param input - Canonical timeline handoff (`tickStartedAt`, annotated trip rows, predictions)
 */
export const updateVesselTimeline = async (
  ctx: ActionCtx,
  input: RunUpdateVesselTimelineInput
): Promise<void> => {
  const { actualEvents, predictedEvents } = runUpdateVesselTimeline(input);
  if (actualEvents.length > 0) {
    await ctx.runMutation(
      internal.functions.events.eventsActual.mutations.projectActualDockWrites,
      { Writes: actualEvents }
    );
  }
  if (predictedEvents.length > 0) {
    await ctx.runMutation(
      internal.functions.events.eventsPredicted.mutations
        .projectPredictedDockWriteBatches,
      { Batches: predictedEvents }
    );
  }
};
