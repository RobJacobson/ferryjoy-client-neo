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
import {
  buildScheduleSnapshotQueryArgs,
  type ScheduleSnapshot,
  type VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
import {
  type RunUpdateVesselTimelineInput,
  runUpdateVesselTimeline,
} from "domain/vesselOrchestration/updateTimeline";
import { runUpdateVesselLocations } from "domain/vesselOrchestration/updateVesselLocations";
import {
  derivePredictionGatesForComputation,
  type PredictedTripComputation,
  runUpdateVesselPredictions,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import {
  type RunUpdateVesselTripsOutput,
  runUpdateVesselTrips,
  type TripComputation,
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
      const { trips, tripApplyResult, tripComputations } =
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
        tickStartedAt,
        tripComputations
      );

      // Step 4: Timeline dock writes → `eventsActual` / `eventsPredicted`.
      await updateVesselTimeline(ctx, {
        tickStartedAt,
        tripComputations: buildTimelineTripComputationsForRun(
          trips,
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
 * @param tickStartedAt - Orchestrator-owned tick anchor (same value as predictions/timeline)
 * @param scheduleContext - Plain-data schedule snapshot for this tick
 * @returns Persist-scoped trip tick outcome (alias-compatible with timeline types)
 */
export const updateVesselTrips = async (
  ctx: ActionCtx,
  convexLocations: ReadonlyArray<ConvexVesselLocation>,
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  tickStartedAt: number,
  scheduleContext: ScheduleSnapshot
): Promise<{
  trips: RunUpdateVesselTripsOutput;
  tripApplyResult: VesselTripPersistResult;
  tripComputations: ReadonlyArray<TripComputation>;
}> => {
  const bindings = createVesselOrchestratorConvexBindings(ctx);
  const trips = await runUpdateVesselTrips({
    tickStartedAt,
    vesselLocations: convexLocations,
    existingActiveTrips: activeTrips,
    scheduleContext,
  });
  const tripApplyResult = await persistVesselTripWriteSet(
    trips,
    bindings.vesselTripMutations
  );
  return {
    trips,
    tripApplyResult,
    tripComputations: trips.tripComputations,
  };
};

/**
 * Preloads the minimal model context required for this tick, computes
 * predictions from canonical trip handoff data, and persists proposals when
 * non-empty.
 *
 * @param ctx - Action context for preload and proposal mutation
 * @param tickStartedAt - Clock anchor shared with the trips compute
 * @param tripComputations - Canonical Stage C handoff
 * @returns Canonical Stage D prediction outputs
 */
export const updateVesselPredictions = async (
  ctx: ActionCtx,
  tickStartedAt: number,
  tripComputations: ReadonlyArray<TripComputation>
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
    tripComputations,
    tickStartedAt
  );
  const predictions = await runUpdateVesselPredictions({
    tickStartedAt,
    tripComputations,
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

const atDockModelTypes = [
  "at-dock-depart-curr",
  "at-dock-arrive-next",
  "at-dock-depart-next",
] as const satisfies readonly ModelType[];

const atSeaModelTypes = [
  "at-sea-arrive-next",
  "at-sea-depart-next",
] as const satisfies readonly ModelType[];

const buildPredictionContextRequests = (
  tripComputations: ReadonlyArray<TripComputation>,
  tickStartedAt: number
): Array<{ pairKey: string; modelTypes: ModelType[] }> => {
  const requestMap = new Map<string, Set<ModelType>>();

  for (const computation of tripComputations) {
    const gates = derivePredictionGatesForComputation(
      computation,
      tickStartedAt
    );
    if (
      !gates.shouldAttemptAtDockPredictions &&
      !gates.shouldAttemptAtSeaPredictions
    ) {
      continue;
    }

    const departing =
      computation.tripCore.withFinalSchedule.DepartingTerminalAbbrev;
    const arriving =
      computation.tripCore.withFinalSchedule.ArrivingTerminalAbbrev;
    if (departing === undefined || arriving === undefined) {
      continue;
    }

    const pairKey = formatTerminalPairKey(departing, arriving);
    const modelTypes = requestMap.get(pairKey) ?? new Set<ModelType>();

    if (gates.shouldAttemptAtDockPredictions) {
      for (const modelType of atDockModelTypes) {
        modelTypes.add(modelType);
      }
    }
    if (gates.shouldAttemptAtSeaPredictions) {
      for (const modelType of atSeaModelTypes) {
        modelTypes.add(modelType);
      }
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
  tripComputations: ReadonlyArray<TripComputation>,
  tickStartedAt: number
): Promise<VesselPredictionContext> => {
  const requests = buildPredictionContextRequests(
    tripComputations,
    tickStartedAt
  );
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
