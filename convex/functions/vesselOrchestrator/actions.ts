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
import { createScheduledSegmentTablesFromSnapshot } from "domain/vesselOrchestration/shared";
import type {
  CompletedTripBoundaryFact,
  PredictedTripComputation,
  ScheduleSnapshot,
} from "domain/vesselOrchestration/shared";
import { computeVesselTripUpdates } from "domain/vesselOrchestration/updateVesselTrips/computeVesselTripUpdates";
import { buildVesselTripPersistencePlan } from "functions/vesselOrchestrator/persistVesselTripWriteSet";
import { computeVesselLocationRows } from "domain/vesselOrchestration/updateVesselLocations";
import {
  predictionModelTypesForTrip,
  runVesselPredictionPing,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";
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
import type { OrchestratorPingPersistence } from "./schemas";

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

  // Step 1: Fetch and normalize live locations, then annotate per-vessel change state.
  const locationUpdates = await loadVesselLocationUpdates(
    ctx,
    pingStartedAt,
    vesselsIdentity,
    terminalsIdentity
  );

  // Step 2: Compute one-vessel trip outcomes, then merge back to the current batch DTOs.
  const tripStage = await runTripStage(
    ctx,
    pingStartedAt,
    locationUpdates,
    activeTrips
  );

  // Step 3: Run prediction models from the merged trip stage, but keep per-vessel outputs.
  const predictionUpdates = await runPredictionStage(
    ctx,
    tripStage.tripUpdates,
    tripStage.tripRows,
    tripStage.completedHandoffs
  );

  // Step 4: Persist the full orchestrator write bundle in one mutation.
  const persistenceBundle = buildOrchestratorPersistenceBundle({
    pingStartedAt,
    locationUpdates,
    existingActiveTrips: activeTrips,
    tripStage,
    predictionUpdates,
  });
  await ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.persistOrchestratorPing,
    persistenceBundle
  );
};

/**
 * Stage vocabulary for the orchestrator ping.
 *
 * The trip stage computes lifecycle outcomes plus any provisional trip fields
 * already inferred from schedule evidence. Downstream stages consume those
 * rows; they do not revisit trip-field inference policy or depend on
 * transient `tripFieldInferenceMethod` metadata.
 */
type OrchestratorPerVesselStageOutputs = {
  location: VesselLocationUpdates;
  trip: VesselTripUpdates;
  prediction: VesselPredictionUpdates;
  timeline: VesselTimelineUpdates;
};

type OrchestratorTripStage = {
  tripUpdates: ReadonlyArray<VesselTripUpdates>;
  tripRows: RunUpdateVesselTripsOutput;
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
};

type PredictionStageInputs = {
  changedTripUpdates: ReadonlyArray<VesselTripUpdates>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
};

type BuildOrchestratorPersistenceBundleArgs = {
  pingStartedAt: number;
  locationUpdates: ReadonlyArray<VesselLocationUpdates>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  tripStage: OrchestratorTripStage;
  predictionUpdates: ReadonlyArray<VesselPredictionUpdates>;
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
 * Runs Step 2 by loading schedule evidence and computing trip rows plus the
 * completion facts needed by downstream stages and final persistence.
 *
 * @param ctx - Convex action context for schedule query and trip mutations
 * @param pingStartedAt - Shared ping timestamp anchor for this run
 * @param locationUpdates - Step 1 location rows for this ping, annotated with
 *   whether each upstream timestamp changed
 * @param activeTrips - Active-trip snapshot from ping start
 * @returns Computed trip rows plus attempted completion facts used by predictions
 */
const runTripStage = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  locationUpdates: ReadonlyArray<VesselLocationUpdates>,
  activeTrips: ReadonlyArray<ConvexVesselTrip>
): Promise<OrchestratorTripStage> => {
  // Reuse one schedule snapshot for all trip rows in this ping.
  const scheduleSnapshot = await ctx.runQuery(
    internal.functions.vesselOrchestrator.queries.getScheduleSnapshotForPing,
    { pingStartedAt }
  );
  const sailingDay = getSailingDay(new Date(pingStartedAt));
  logTripStageLocationSkipSummary(locationUpdates);
  const tripUpdates = computeTripUpdatesForPing(
    locationUpdates,
    activeTrips,
    scheduleSnapshot,
    sailingDay
  );
  const tripRows = mergeTripRowsFromUpdates(activeTrips, tripUpdates);
  const { attemptedCompletedFacts } = buildVesselTripPersistencePlan(
    tripRows,
    activeTrips
  );
  return {
    tripUpdates,
    tripRows,
    completedHandoffs: attemptedCompletedFacts,
  };
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
const loadVesselLocationUpdates = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<ReadonlyArray<VesselLocationUpdates>> => {
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

  return convexLocations.map((vesselLocation) => ({
    vesselLocation,
    locationChanged:
      previousTimestampByVesselAbbrev.get(vesselLocation.VesselAbbrev) !==
      vesselLocation.TimeStamp,
  }));
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
  const locationUpdates = await loadVesselLocationUpdates(
    ctx,
    pingStartedAt,
    vesselsIdentity,
    terminalsIdentity
  );
  const changedLocations = changedLocationsFromUpdates(locationUpdates);
  if (changedLocations.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselLocationsUpdates.mutations
        .bulkUpsertLocationsAndUpdates,
      { locations: [...changedLocations] }
    );
  }
  return locationUpdates.map((update) => update.vesselLocation);
};

/**
 * Computes the authoritative trip rows for this ping as a pure domain step.
 *
 * The returned rows carry only the durable trip contract. Debug-only
 * trip-field inference metadata is intentionally consumed before this boundary.
 *
 * @param vesselLocations - Live locations from {@link updateVesselLocations}
 * @param existingActiveTrips - Preloaded active trip rows from the orchestrator snapshot
 * @param scheduleSnapshot - Plain-data schedule evidence snapshot for this ping
 * @param sailingDay - Same sailing day used to load the snapshot (narrowing for lookups)
 * @returns The resulting completed and active trip rows for this ping
 */
export const updateVesselTrips = (
  vesselLocations: ReadonlyArray<ConvexVesselLocation>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleSnapshot: ScheduleSnapshot,
  sailingDay: string
): RunUpdateVesselTripsOutput =>
  mergeTripRowsFromUpdates(
    existingActiveTrips,
    computeTripUpdatesForPing(
      vesselLocations.map((vesselLocation) => ({
        vesselLocation,
        locationChanged: true,
      })),
      existingActiveTrips,
      scheduleSnapshot,
      sailingDay
    )
  );

/**
 * Preloads the minimal model context required for this ping, computes
 * predictions from canonical trip handoff data.
 *
 * @param ctx - Action context for prediction model preload
 * @param trips - Current ping trip rows
 * @param completedHandoffs - Attempted completed-trip rollover pairings for replacement-trip predictions
 * @returns Prediction rows plus timeline ML merge handoffs
 */
export const runPredictionStage = async (
  ctx: ActionCtx,
  tripUpdates: ReadonlyArray<VesselTripUpdates>,
  trips: RunUpdateVesselTripsOutput,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): Promise<ReadonlyArray<VesselPredictionUpdates>> => {
  const predictionInputs = buildPredictionStageInputs(
    tripUpdates,
    trips,
    completedHandoffs
  );
  const predictionContext = await loadPredictionContext(
    ctx,
    predictionInputs.activeTrips,
    predictionInputs.completedHandoffs
  );
  const ping = await runVesselPredictionPing({
    activeTrips: predictionInputs.activeTrips,
    completedHandoffs: predictionInputs.completedHandoffs,
    predictionContext,
  });
  return buildPredictionUpdatesByVessel(
    predictionInputs.changedTripUpdates,
    ping.predictionRows,
    ping.predictedTripComputations,
    predictionInputs.completedHandoffs
  );
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

const computeTripUpdatesForPing = (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleSnapshot: ScheduleSnapshot,
  sailingDay: string
): ReadonlyArray<VesselTripUpdates> => {
  const scheduleTables = createScheduledSegmentTablesFromSnapshot(
    scheduleSnapshot,
    sailingDay
  );
  const existingActiveTripsByVessel = new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  return locationUpdates
    .filter((update) => update.locationChanged)
    .map(({ vesselLocation }) =>
      computeVesselTripUpdates({
        vesselLocation,
        existingActiveTrip: existingActiveTripsByVessel.get(
          vesselLocation.VesselAbbrev
        ),
        scheduleTables,
      })
    );
};

const logTripStageLocationSkipSummary = (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>
): void => {
  const skippedCount = locationUpdates.filter(
    (update) => !update.locationChanged
  ).length;
  if (skippedCount === 0) {
    return;
  }

  const changedCount = locationUpdates.length - skippedCount;
  if (changedCount > 0) {
    return;
  }

  console.info("[VesselOrchestrator] Trip stage skipped unchanged locations", {
    skippedCount,
    changedCount,
    totalLocations: locationUpdates.length,
  });
};

const shouldContinueAfterTripUpdate = (tripUpdate: VesselTripUpdates): boolean =>
  tripUpdate.tripStorageChanged || tripUpdate.tripLifecycleChanged;

const mergeTripRowsFromUpdates = (
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  tripUpdates: ReadonlyArray<VesselTripUpdates>
): RunUpdateVesselTripsOutput => {
  const processedActiveTrips = tripUpdates
    .map((updates) => updates.activeTripCandidate)
    .filter((trip): trip is ConvexVesselTrip => trip !== undefined);

  const mergedActiveTripsByVessel = new Map<string, ConvexVesselTrip>([
    ...existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
    ...processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
  ]);

  return {
    completedTrips: tripUpdates
      .map((updates) => updates.completedTrip)
      .filter((trip): trip is ConvexVesselTrip => trip !== undefined),
    activeTrips: [...mergedActiveTripsByVessel.values()],
  };
};

const buildPredictionStageInputs = (
  tripUpdates: ReadonlyArray<VesselTripUpdates>,
  trips: RunUpdateVesselTripsOutput,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): PredictionStageInputs => {
  const changedTripUpdates = tripUpdates.filter(shouldContinueAfterTripUpdate);
  const changedVesselAbbrevs = new Set(
    changedTripUpdates.map((update) => update.vesselLocation.VesselAbbrev)
  );

  return {
    changedTripUpdates,
    activeTrips: trips.activeTrips.filter((trip) =>
      changedVesselAbbrevs.has(trip.VesselAbbrev)
    ),
    completedHandoffs: completedHandoffs.filter((handoff) =>
      changedVesselAbbrevs.has(handoff.tripToComplete.VesselAbbrev)
    ),
  };
};

const buildOrchestratorPersistenceBundle = ({
  pingStartedAt,
  locationUpdates,
  existingActiveTrips,
  tripStage,
  predictionUpdates,
}: BuildOrchestratorPersistenceBundleArgs): OrchestratorPingPersistence => ({
  pingStartedAt,
  changedLocations: [...changedLocationsFromUpdates(locationUpdates)],
  existingActiveTrips: [...existingActiveTrips],
  tripRows: {
    activeTrips: [...tripStage.tripRows.activeTrips],
    completedTrips: [...tripStage.tripRows.completedTrips],
  },
  predictionRows: [...mergePredictionRows(predictionUpdates)],
  predictedTripComputations: [
    ...mergePredictedTripComputations(predictionUpdates),
  ],
});

const changedLocationsFromUpdates = (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>
): ReadonlyArray<ConvexVesselLocation> =>
  locationUpdates
    .filter((update) => update.locationChanged)
    .map((update) => update.vesselLocation);

const buildPredictionUpdatesByVessel = (
  tripUpdates: ReadonlyArray<VesselTripUpdates>,
  predictionRows: ReadonlyArray<
    Awaited<ReturnType<typeof runVesselPredictionPing>>["predictionRows"][number]
  >,
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): ReadonlyArray<VesselPredictionUpdates> => {
  const vesselAbbrevs = new Set<string>([
    ...tripUpdates.map((update) => update.vesselLocation.VesselAbbrev),
    ...completedHandoffs.map((handoff) => handoff.tripToComplete.VesselAbbrev),
  ]);

  const predictionRowsByVessel = new Map<string, Array<(typeof predictionRows)[number]>>();
  for (const predictionRow of predictionRows) {
    const rows = predictionRowsByVessel.get(predictionRow.VesselAbbrev) ?? [];
    rows.push(predictionRow);
    predictionRowsByVessel.set(predictionRow.VesselAbbrev, rows);
  }

  const predictedTripComputationsByVessel = new Map<
    string,
    Array<PredictedTripComputation>
  >();
  for (const computation of predictedTripComputations) {
    const computations =
      predictedTripComputationsByVessel.get(computation.vesselAbbrev) ?? [];
    computations.push(computation);
    predictedTripComputationsByVessel.set(computation.vesselAbbrev, computations);
  }

  const completedHandoffsByVessel = new Map<
    string,
    Array<CompletedTripBoundaryFact>
  >();
  for (const completedHandoff of completedHandoffs) {
    const handoffs =
      completedHandoffsByVessel.get(completedHandoff.tripToComplete.VesselAbbrev) ??
      [];
    handoffs.push(completedHandoff);
    completedHandoffsByVessel.set(
      completedHandoff.tripToComplete.VesselAbbrev,
      handoffs
    );
  }

  return [...vesselAbbrevs].map((vesselAbbrev) => ({
    vesselAbbrev,
    predictionRows: predictionRowsByVessel.get(vesselAbbrev) ?? [],
    predictedTripComputations:
      predictedTripComputationsByVessel.get(vesselAbbrev) ?? [],
    completedHandoffs: completedHandoffsByVessel.get(vesselAbbrev) ?? [],
  }));
};

const mergePredictionRows = (
  predictionUpdates: ReadonlyArray<VesselPredictionUpdates>
): ReadonlyArray<VesselPredictionUpdates["predictionRows"][number]> =>
  predictionUpdates.flatMap((predictionUpdate) => predictionUpdate.predictionRows);

const mergePredictedTripComputations = (
  predictionUpdates: ReadonlyArray<VesselPredictionUpdates>
): ReadonlyArray<PredictedTripComputation> =>
  predictionUpdates.flatMap(
    (predictionUpdate) => predictionUpdate.predictedTripComputations
  );

export type { OrchestratorPerVesselStageOutputs, PredictionStageInputs };
export {
  buildOrchestratorPersistenceBundle,
  buildPredictionStageInputs,
  computeTripUpdatesForPing,
  logTripStageLocationSkipSummary,
  shouldContinueAfterTripUpdate,
};
