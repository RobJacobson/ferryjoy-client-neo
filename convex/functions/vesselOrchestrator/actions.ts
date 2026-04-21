/**
 * Vessel orchestrator actions.
 *
 * The trip step now uses a pure `computeVesselTripsRows` boundary. Persistence,
 * predictions, and timeline wiring still need follow-up refactors before this
 * orchestrator regains its full end-to-end flow.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type {
  CompletedTripBoundaryFact,
  PredictedTripComputation,
  ScheduleSnapshot,
} from "domain/vesselOrchestration/shared";
import {
  type RunUpdateVesselTimelineInput,
  runUpdateVesselTimeline,
} from "domain/vesselOrchestration/updateTimeline";
import { computeVesselLocationRows } from "domain/vesselOrchestration/updateVesselLocations";
import {
  predictionModelTypesForTrip,
  runVesselPredictionPing,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import {
  computeVesselTripsRows,
  type RunUpdateVesselTripsOutput,
} from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getSailingDay } from "shared/time";
import { persistVesselTripWriteSet } from "./persistVesselTripWriteSet";
import { assembleTripComputationsFromPersistResult } from "./assembleTripComputationsFromPersistResult";
import { buildTimelineTripComputationsForRun } from "./buildTimelineTripComputationsForRun";
import { createVesselOrchestratorConvexBindings } from "./utils";

/**
 * Internal action: load identity and active trips, fetch live locations, and run
 * the pure trip update for the ping.
 *
 * @returns Nothing; logs and rethrows on failure
 * @throws When identity tables are empty, WSF fetch fails, or downstream
 *   post-trip orchestration has not been adapted yet
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
          "vesselsIdentity or terminalsIdentity empty; skipping ping."
        );
      }

      const { vesselsIdentity, terminalsIdentity, activeTrips } = snapshot;

      // One wall-clock anchor for this entire orchestrator run (locations → trips →
      // predictions → timeline). Sub-minute policy (e.g. prediction fallback) keys off
      // this instant—not "start of trip compute after WSF fetch."
      const pingStartedAt = Date.now();

      // Step 1: WSF fetch → Convex `vesselLocations` bulk upsert.
      const convexLocations = await updateVesselLocations(
        ctx,
        pingStartedAt,
        vesselsIdentity,
        terminalsIdentity
      );

      const scheduleSnapshot = await ctx.runQuery(
        internal.functions.vesselOrchestrator.queries
          .getScheduleSnapshotForPing,
        { pingStartedAt }
      );
      const sailingDay = getSailingDay(new Date(pingStartedAt));

      // Step 2: Pure trip compute from locations + schedule snapshot.
      const tripRows = await updateVesselTrips(
        convexLocations,
        activeTrips,
        scheduleSnapshot,
        sailingDay
      );
      const { vesselTripMutations } = createVesselOrchestratorConvexBindings(ctx);
      // Persist only changed active rows plus every completed-row rollover.
      const tripPersistResult = await persistVesselTripWriteSet(
        tripRows,
        activeTrips,
        vesselTripMutations
      );

      const predictionResult = await runAndPersistVesselPredictionPing(
        ctx,
        tripRows,
        tripPersistResult.completedFacts
      );

      const tripComputations = assembleTripComputationsFromPersistResult(
        tripRows,
        tripPersistResult
      );
      const timelineTripComputations = buildTimelineTripComputationsForRun(
        tripRows,
        tripComputations,
        tripPersistResult
      );
      await updateVesselTimeline(ctx, {
        pingStartedAt,
        tripComputations: timelineTripComputations,
        predictedTripComputations: predictionResult.predictedTripComputations,
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
 * @param pingStartedAt - Orchestrator-owned ping anchor shared with the domain runner
 * @param vesselsIdentity - Backend vessel rows for feed resolution
 * @param terminalsIdentity - Backend terminal rows for normalization
 * @returns Location rows written (or skipped as stale) by the mutation path
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  const { vesselLocations: convexLocations } = await computeVesselLocationRows({
    pingStartedAt,
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
 * Computes the authoritative trip rows for this ping as a pure domain step.
 *
 * @param vesselLocations - Live locations from {@link updateVesselLocations}
 * @param existingActiveTrips - Preloaded active trip rows from the orchestrator snapshot
 * @param scheduleSnapshot - Plain-data schedule snapshot for this ping
 * @param sailingDay - Same sailing day used to load the snapshot (narrowing for lookups)
 * @returns The resulting completed and active trip rows for this ping
 */
export const updateVesselTrips = (
  vesselLocations: ReadonlyArray<ConvexVesselLocation>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleSnapshot: ScheduleSnapshot,
  sailingDay: string
): RunUpdateVesselTripsOutput =>
  computeVesselTripsRows({
    vesselLocations: vesselLocations,
    existingActiveTrips: existingActiveTrips,
    scheduleSnapshot,
    sailingDay,
  });

/**
 * Preloads the minimal model context required for this ping, computes
 * predictions from canonical trip handoff data, and persists proposals when
 * non-empty.
 *
 * @param ctx - Action context for preload and proposal mutation
 * @param trips - Current ping trip rows
 * @param completedHandoffs - Completed-trip rollover pairings for replacement-trip predictions
 * @returns Prediction rows plus timeline ML merge handoffs (shared type)
 */
export const runAndPersistVesselPredictionPing = async (
  ctx: ActionCtx,
  trips: RunUpdateVesselTripsOutput,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): Promise<{
  predictionRows: ReadonlyArray<
    Awaited<
      ReturnType<typeof runVesselPredictionPing>
    >["predictionRows"][number]
  >;
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>;
}> => {
  const predictionContext = await loadPredictionContext(
    ctx,
    trips.activeTrips,
    completedHandoffs
  );
  const ping = await runVesselPredictionPing({
    activeTrips: trips.activeTrips,
    completedHandoffs,
    predictionContext,
  });
  if (ping.predictionRows.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselTripPredictions.mutations.batchUpsertProposals,
      { proposals: [...ping.predictionRows] }
    );
  }
  return {
    predictionRows: ping.predictionRows,
    predictedTripComputations: ping.predictedTripComputations,
  };
};

const buildPredictionContextRequests = (
  activeTrips: ReadonlyArray<ConvexVesselTrip>,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): Array<{ pairKey: string; modelTypes: ModelType[] }> => {
  const requestMap = new Map<string, Set<ModelType>>();

  const tripsToPredict = [
    ...completedHandoffs.map((handoff) => handoff.scheduleTrip),
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
  const requests = buildPredictionContextRequests(
    activeTrips,
    completedHandoffs
  );
  if (requests.length === 0) {
    return {};
  }

  const productionModelsByPair = await ctx.runQuery(
    internal.functions.predictions.queries.getProductionModelParametersForPing,
    { requests }
  );
  return { productionModelsByPair };
};

/**
 * Dock projection for this ping: calls domain {@link runUpdateVesselTimeline} with
 * the same {@link RunUpdateVesselTimelineInput} shape the PRD specifies (orchestrator
 * builds {@link TimelineTripComputation} rows via
 * {@link buildTimelineTripComputationsForRun} after persist).
 *
 * @param ctx - Action context for timeline mutations
 * @param input - Canonical timeline handoff (`pingStartedAt`, annotated trip rows, predictions)
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
