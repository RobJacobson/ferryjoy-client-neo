/**
 * Vessel orchestrator actions.
 *
 * The action now computes one ping's plain-data bundle, then hands the full hot
 * write path to a single orchestrator-owned internal mutation.
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
} from "domain/vesselOrchestration/shared";
import { buildVesselTripPersistencePlan } from "functions/vesselOrchestrator/persistVesselTripWriteSet";
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
import type {
  VesselLocationUpdates,
  VesselPredictionUpdates,
  VesselTimelineUpdates,
  VesselTripUpdates,
} from "./pipelineTypes";

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

  // Step 1: WSF fetch and diff `vesselLocations`; persistence happens later.
  const { vesselLocations, changedLocations } = await loadVesselLocationWriteSet(
    ctx,
    pingStartedAt,
    vesselsIdentity,
    terminalsIdentity
  );

  // Step 2: Compute trip rows and the completed-handoff prediction context.
  const { tripRows, completedHandoffs } = await runTripStep(
    ctx,
    pingStartedAt,
    vesselLocations,
    activeTrips
  );

  // Step 3: Run prediction models; persistence happens in the write mutation.
  const predictionResult = await runVesselPredictionStep(
    ctx,
    tripRows,
    completedHandoffs
  );

  // Step 4: Persist the full orchestrator write bundle in one mutation.
  await ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.persistOrchestratorPing,
    {
      pingStartedAt,
      changedLocations: [...changedLocations],
      existingActiveTrips: [...activeTrips],
      tripRows: {
        activeTrips: [...tripRows.activeTrips],
        completedTrips: [...tripRows.completedTrips],
      },
      predictionRows: [...predictionResult.predictionRows],
      predictedTripComputations: [...predictionResult.predictedTripComputations],
    }
  );
};

/**
 * Stage vocabulary for the in-progress per-vessel pipeline refactor.
 *
 * The current action still computes mostly batch-shaped arrays, but these type
 * aliases make the intended single-vessel stage contracts explicit at the
 * action boundary before Task 2 extracts the pure per-vessel helpers.
 */
type OrchestratorPerVesselStageOutputs = {
  location: VesselLocationUpdates;
  trip: VesselTripUpdates;
  prediction: VesselPredictionUpdates;
  timeline: VesselTimelineUpdates;
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
 * @param vesselLocations - Step 1 location rows for this ping
 * @param activeTrips - Active-trip snapshot from ping start
 * @returns Computed trip rows plus attempted completion facts used by predictions
 */
const runTripStep = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselLocations: ReadonlyArray<ConvexVesselLocation>,
  activeTrips: ReadonlyArray<ConvexVesselTrip>
): Promise<{
  tripRows: RunUpdateVesselTripsOutput;
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
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
  const { attemptedCompletedFacts } = buildVesselTripPersistencePlan(
    tripRows,
    activeTrips
  );
  return { tripRows, completedHandoffs: attemptedCompletedFacts };
};

/**
 * Fetches live vessel locations from WSF and returns the changed write set.
 *
 * @param ctx - Convex action context for the location mutation
 * @param pingStartedAt - Orchestrator-owned ping anchor shared with the domain runner
 * @param vesselsIdentity - Backend vessel rows for feed resolution
 * @param terminalsIdentity - Backend terminal rows for normalization
 * @returns Full location rows plus the subset whose upstream timestamp advanced
 */
const loadVesselLocationWriteSet = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<{
  vesselLocations: ReadonlyArray<ConvexVesselLocation>;
  changedLocations: ReadonlyArray<ConvexVesselLocation>;
}> => {
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

  return {
    vesselLocations: convexLocations,
    changedLocations,
  };
};

/**
 * Backward-compatible wrapper used by focused location tests while the main
 * orchestrator path now persists through `persistOrchestratorPing`.
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  const { vesselLocations, changedLocations } = await loadVesselLocationWriteSet(
    ctx,
    pingStartedAt,
    vesselsIdentity,
    terminalsIdentity
  );
  if (changedLocations.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselLocationsUpdates.mutations
        .bulkUpsertLocationsAndUpdates,
      { locations: [...changedLocations] }
    );
  }
  return vesselLocations;
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
 * predictions from canonical trip handoff data.
 *
 * @param ctx - Action context for prediction model preload
 * @param trips - Current ping trip rows
 * @param completedHandoffs - Attempted completed-trip rollover pairings for replacement-trip predictions
 * @returns Prediction rows plus timeline ML merge handoffs
 */
export const runVesselPredictionStep = async (
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

export type { OrchestratorPerVesselStageOutputs };
