/**
 * Vessel orchestrator actions.
 *
 * The trip step now uses a pure `computeVesselTripsRows` boundary. Persistence,
 * predictions, and timeline wiring still need follow-up refactors before this
 * orchestrator regains its full end-to-end flow.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import type {
  CompletedTripBoundaryFact,
  PredictedTripComputation,
  ScheduleSnapshot,
  VesselTripPersistResult,
} from "domain/vesselOrchestration/shared";
import {
  type RunUpdateVesselTimelineFromAssemblyInput,
  runUpdateVesselTimelineFromAssembly,
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
      await runOrchestratorPing(ctx);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator]", err);
      throw err;
    }
  },
});

/**
 * Runs one full orchestrator ping from location ingest through timeline writes.
 *
 * @param ctx - Convex action context for all ping-side reads and writes
 */
const runOrchestratorPing = async (ctx: ActionCtx): Promise<void> => {
  const snapshot = await loadOrchestratorSnapshot(ctx);
  const { vesselsIdentity, terminalsIdentity, activeTrips } = snapshot;
  const pingStartedAt = Date.now();

  // Step 1: WSF fetch and persist `vesselLocations`.
  const vesselLocations = await updateVesselLocations(
    ctx,
    pingStartedAt,
    vesselsIdentity,
    terminalsIdentity
  );

  // Step 2: Compute trip rows, then persist only material changes.
  const { tripRows, tripPersistResult } = await runTripStep(
    ctx,
    pingStartedAt,
    vesselLocations,
    activeTrips
  );

  // Step 3: Run prediction models and persist prediction proposals.
  const predictionResult = await runAndPersistVesselPredictionPing(
    ctx,
    tripRows,
    tripPersistResult.completedFacts
  );

  // Step 4: Build gated timeline rows and project them to events tables.
  await runTimelineStep(
    ctx,
    pingStartedAt,
    tripPersistResult,
    predictionResult.predictedTripComputations
  );
};

/**
 * Loads the baseline read model required for one orchestrator ping.
 *
 * @param ctx - Convex action context for internal snapshot query
 * @returns Identity tables plus current active trips
 * @throws When identity tables are empty and the ping should be skipped
 */
const loadOrchestratorSnapshot = async (
  ctx: ActionCtx
): Promise<{
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
}> => {
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
  return snapshot;
};

/**
 * Runs Step 2 by loading schedule context, computing trip rows, and persisting
 * trip-table writes.
 *
 * @param ctx - Convex action context for schedule query and trip mutations
 * @param pingStartedAt - Shared ping timestamp anchor for this run
 * @param vesselLocations - Step 1 location rows persisted for this ping
 * @param activeTrips - Active-trip snapshot from ping start
 * @returns Computed trip rows plus persistence outcomes used by later steps
 */
const runTripStep = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselLocations: ReadonlyArray<ConvexVesselLocation>,
  activeTrips: ReadonlyArray<ConvexVesselTrip>
): Promise<{
  tripRows: RunUpdateVesselTripsOutput;
  tripPersistResult: Awaited<ReturnType<typeof persistVesselTripWriteSet>>;
}> => {
  // Reuse one schedule snapshot for all trip rows in this ping.
  const scheduleSnapshot = await ctx.runQuery(
    internal.functions.vesselOrchestrator.queries.getScheduleSnapshotForPing,
    { pingStartedAt }
  );
  const sailingDay = getSailingDay(new Date(pingStartedAt));
  const tripRows = updateVesselTrips(
    vesselLocations,
    activeTrips,
    scheduleSnapshot,
    sailingDay
  );
  const { vesselTripMutations } = createVesselOrchestratorConvexBindings(ctx);
  const tripPersistResult = await persistVesselTripWriteSet(
    tripRows,
    activeTrips,
    vesselTripMutations
  );
  return { tripRows, tripPersistResult };
};

/**
 * Runs Step 4 by passing persisted timeline assembly rows directly into the
 * timeline concern and projecting resulting writes.
 *
 * @param ctx - Convex action context for timeline mutations
 * @param pingStartedAt - Shared ping timestamp anchor for this run
 * @param tripPersistResult - Step 2 persistence result including branch handoffs
 * @param predictedTripComputations - Step 3 ML overlay handoffs
 */
const runTimelineStep = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  tripPersistResult: VesselTripPersistResult,
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>
): Promise<void> => {
  const timelineInput: RunUpdateVesselTimelineFromAssemblyInput = {
    pingStartedAt,
    projectionAssembly: {
      completedFacts: tripPersistResult.completedFacts,
      currentBranch: tripPersistResult.currentBranch,
    },
    predictedTripComputations,
  };
  await updateVesselTimeline(ctx, {
    ...timelineInput,
  });
};

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

  // Load lightweight per-vessel update signatures for dedupe.
  const existingUpdates = await ctx.runQuery(
    internal.functions.vesselLocationsUpdates.queries
      .getAllVesselUpdateTimeStampsInternal
  );

  // Map prior timestamps by vessel abbrev for O(1) change checks.
  const previousTimestampByVesselAbbrev = new Map(
    existingUpdates.map((row) => [row.VesselAbbrev, row.TimeStamp] as const)
  );

  // Filter locations whose upstream timestamp advanced since last ping.
  const changedLocations = convexLocations.filter(
    (location) =>
      previousTimestampByVesselAbbrev.get(location.VesselAbbrev) !==
      location.TimeStamp
  );

  // Upsert changed locations and their update signatures in one mutation.
  if (changedLocations.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselLocationsUpdates.mutations
        .bulkUpsertLocationsAndUpdates,
      { locations: changedLocations }
    );
    // Legacy heavy path kept commented for prototype rollback only.
    // await ctx.runMutation(
    //   internal.functions.vesselLocation.mutations.bulkUpsert,
    //   { locations: changedLocations }
    // );
  }

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

/**
 * Builds terminal-pair model-load requests for Step 3 prediction context.
 *
 * @param activeTrips - Active trips from this ping
 * @param completedHandoffs - Completed rollover facts from Step 2 persistence
 * @returns Distinct terminal-pair requests with model types merged per pair
 */
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
    // Merge model requests by terminal pair so one query can load all needed
    // model variants for that pair.
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

/**
 * Loads production ML model parameters needed by Step 3 for this ping.
 *
 * @param ctx - Convex action context for prediction model query
 * @param activeTrips - Active trips to evaluate this ping
 * @param completedHandoffs - Completed rollover handoffs from Step 2
 * @returns Terminal-pair keyed production model payloads (or empty context)
 */
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
 * Dock projection for this ping: calls domain
 * {@link runUpdateVesselTimelineFromAssembly} with direct projection assembly
 * rows after Step 2 persistence and Step 3 prediction merge.
 *
 * @param ctx - Action context for timeline mutations
 * @param input - Canonical timeline handoff (`pingStartedAt`, projection assembly, predictions)
 */
export const updateVesselTimeline = async (
  ctx: ActionCtx,
  input: RunUpdateVesselTimelineFromAssemblyInput
): Promise<void> => {
  const { actualEvents, predictedEvents } =
    runUpdateVesselTimelineFromAssembly(input);
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
