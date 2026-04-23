/**
 * Vessel orchestrator actions.
 *
 * The hot path keeps one baseline snapshot query, one WSF fetch, one visible
 * per-vessel trip loop for changed locations, and one final persistence
 * mutation only when writes are needed.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { fetchRawWsfVesselLocations } from "adapters";
import type { Infer } from "convex/values";
import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled";
import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { ModelType } from "domain/ml/shared/types";
import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import type {
  CompletedTripBoundaryFact,
  PredictedTripComputation,
  ScheduleContinuityAccess,
  ScheduleSnapshot,
} from "domain/vesselOrchestration/shared";
import { createScheduleContinuityAccessFromSnapshot } from "domain/vesselOrchestration/shared";
import type { CompactScheduledDepartureEvent } from "domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes";
import { computeVesselLocationRows } from "domain/vesselOrchestration/updateVesselLocations";
import {
  predictionModelTypesForTrip,
  runVesselPredictionPing,
  type VesselPredictionContext,
} from "domain/vesselOrchestration/updateVesselPredictions";
import type {
  RunUpdateVesselTripsOutput,
  VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrips";
import { computeVesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildVesselTripPersistencePlan } from "functions/vesselOrchestrator/persistVesselTripWriteSet";
import type {
  storedVesselLocationSchema,
  VesselLocationUpdates,
  VesselPredictionUpdates,
} from "functions/vesselOrchestrator/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { OrchestratorPingPersistence } from "./schemas";

type StoredVesselLocation = Infer<typeof storedVesselLocationSchema>;

type OrchestratorSnapshot = {
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  storedLocations: ReadonlyArray<StoredVesselLocation>;
};

type OrchestratorTripStage = {
  tripUpdates: ReadonlyArray<VesselTripUpdate>;
  tripRows: RunUpdateVesselTripsOutput;
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>;
};

type PredictionStageInputs = {
  changedTripUpdates: ReadonlyArray<VesselTripUpdate>;
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
 * Internal action: load identity and active trips, fetch live locations, and
 * persist one orchestrator ping when required.
 *
 * @returns Nothing; logs and rethrows on failure
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
  const pingStartedAt = Date.now();
  const locationUpdates = await loadVesselLocationUpdates({
    pingStartedAt,
    storedLocations: snapshot.storedLocations,
    terminalsIdentity: snapshot.terminalsIdentity,
    vesselsIdentity: snapshot.vesselsIdentity,
  });

  logTripStageLocationSkipSummary(locationUpdates);
  const changedLocationUpdates = locationUpdates.filter(
    (update) => update.locationChanged
  );
  if (changedLocationUpdates.length === 0) {
    return;
  }

  const tripStage = await runTripStage(
    ctx,
    changedLocationUpdates,
    snapshot.activeTrips
  );
  const predictionUpdates = await runPredictionStage(
    ctx,
    tripStage.tripUpdates,
    tripStage.tripRows,
    tripStage.completedHandoffs
  );

  await ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.persistOrchestratorPing,
    buildOrchestratorPersistenceBundle({
      pingStartedAt,
      locationUpdates,
      existingActiveTrips: snapshot.activeTrips,
      tripStage,
      predictionUpdates,
    })
  );
};

/**
 * Loads the baseline read model required for one orchestrator ping.
 *
 * @param ctx - Convex action context for internal snapshot query
 * @returns Identity tables, active trips, and current stored locations
 */
const loadOrchestratorSnapshot = async (
  ctx: ActionCtx
): Promise<OrchestratorSnapshot> => {
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
 * Fetches live vessel locations from WSF and compares them to stored rows.
 *
 * @param args - Ping timestamp, identity tables, and stored location rows
 * @returns Full location rows annotated with change state and existing ids
 */
const loadVesselLocationUpdates = async ({
  pingStartedAt,
  storedLocations,
  terminalsIdentity,
  vesselsIdentity,
}: {
  pingStartedAt: number;
  storedLocations: ReadonlyArray<StoredVesselLocation>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
}): Promise<ReadonlyArray<VesselLocationUpdates>> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  const { vesselLocations } = await computeVesselLocationRows({
    pingStartedAt,
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity,
  });
  const storedLocationsByVessel = new Map(
    storedLocations.map((row) => [row.VesselAbbrev, row] as const)
  );

  return vesselLocations.map((vesselLocation) => {
    const existingLocation = storedLocationsByVessel.get(
      vesselLocation.VesselAbbrev
    );

    return {
      vesselLocation,
      existingLocationId: existingLocation?._id,
      locationChanged: existingLocation?.TimeStamp !== vesselLocation.TimeStamp,
    };
  });
};

/**
 * Backward-compatible wrapper used by focused location tests.
 *
 * @param ctx - Action context for snapshot and persistence calls
 * @param pingStartedAt - Orchestrator-owned ping anchor
 * @param vesselsIdentity - Backend vessel rows for feed resolution
 * @param terminalsIdentity - Backend terminal rows for normalization
 * @returns Normalized current vessel-location rows
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  const storedLocations = await ctx.runQuery(
    internal.functions.vesselOrchestrator.queries.getOrchestratorModelData
  );
  const locationUpdates = await loadVesselLocationUpdates({
    pingStartedAt,
    storedLocations: storedLocations.storedLocations,
    terminalsIdentity,
    vesselsIdentity,
  });
  const changedLocations = changedLocationUpdatesFromUpdates(locationUpdates);

  if (changedLocations.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselOrchestrator.mutations.persistOrchestratorPing,
      {
        pingStartedAt,
        changedLocations: [...changedLocations],
        existingActiveTrips: [],
        tripRows: {
          activeTrips: [],
          completedTrips: [],
        },
        predictionRows: [],
        predictedTripComputations: [],
      }
    );
  }

  return locationUpdates.map((update) => update.vesselLocation);
};

/**
 * Computes trip updates only for changed vessel locations.
 *
 * @param ctx - Action context for targeted schedule queries
 * @param changedLocationUpdates - Changed live locations for this ping
 * @param existingActiveTrips - Active-trip snapshot from ping start
 * @returns Trip rows and completed handoffs for downstream prediction/timeline work
 */
const runTripStage = async (
  ctx: ActionCtx,
  changedLocationUpdates: ReadonlyArray<VesselLocationUpdates>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): Promise<OrchestratorTripStage> => {
  const scheduleAccess = createScheduleContinuityAccess(ctx);
  return computeTripStageForLocations(
    changedLocationUpdates,
    existingActiveTrips,
    scheduleAccess
  );
};

/**
 * Computes trip updates for a changed-vessel subset using the provided schedule access.
 *
 * @param changedLocationUpdates - Changed live locations for this ping
 * @param existingActiveTrips - Active-trip snapshot from ping start
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Trip rows and completed handoffs for downstream work
 */
const computeTripStageForLocations = async (
  changedLocationUpdates: ReadonlyArray<VesselLocationUpdates>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleAccess: ScheduleContinuityAccess
): Promise<OrchestratorTripStage> => {
  const activeTripsByVessel = new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const completedTrips: Array<ConvexVesselTrip> = [];
  const tripUpdates: Array<VesselTripUpdate> = [];

  for (const locationUpdate of changedLocationUpdates) {
    const vesselAbbrev = locationUpdate.vesselLocation.VesselAbbrev;
    const tripUpdate = await computeVesselTripUpdate({
      vesselLocation: locationUpdate.vesselLocation,
      existingActiveTrip: activeTripsByVessel.get(vesselAbbrev),
      scheduleAccess,
    });

    tripUpdates.push(tripUpdate);

    if (tripUpdate.completedTrip) {
      completedTrips.push(tripUpdate.completedTrip);
    }

    if (tripUpdate.activeTripCandidate) {
      activeTripsByVessel.set(vesselAbbrev, tripUpdate.activeTripCandidate);
      continue;
    }

    if (tripUpdate.existingActiveTrip) {
      activeTripsByVessel.delete(vesselAbbrev);
    }
  }

  const tripRows = {
    activeTrips: [...activeTripsByVessel.values()],
    completedTrips,
  };
  const { attemptedCompletedFacts } = buildVesselTripPersistencePlan(
    tripRows,
    existingActiveTrips
  );

  return {
    tripUpdates,
    tripRows,
    completedHandoffs: attemptedCompletedFacts,
  };
};

/**
 * Computes the authoritative trip rows for this ping.
 *
 * @param vesselLocations - Live locations from the orchestrator
 * @param existingActiveTrips - Preloaded active trip rows from the orchestrator snapshot
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns The resulting completed and active trip rows for this ping
 */
export const updateVesselTrips = async (
  vesselLocations: ReadonlyArray<ConvexVesselLocation>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleAccess: ScheduleContinuityAccess
): Promise<RunUpdateVesselTripsOutput> =>
  (
    await computeTripStageForLocations(
      vesselLocations.map((vesselLocation) => ({
        vesselLocation,
        locationChanged: true,
      })),
      existingActiveTrips,
      scheduleAccess
    )
  ).tripRows;

/**
 * Runs prediction work only for vessels whose durable trip facts changed.
 *
 * @param ctx - Action context for prediction model preload
 * @param tripUpdates - Per-vessel trip updates for changed locations
 * @param trips - Authoritative trip rows after the trip stage
 * @param completedHandoffs - Completed rollover handoffs from trip persistence planning
 * @returns Per-vessel prediction rows and timeline ML handoffs
 */
export const runPredictionStage = async (
  ctx: ActionCtx,
  tripUpdates: ReadonlyArray<VesselTripUpdate>,
  trips: RunUpdateVesselTripsOutput,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): Promise<ReadonlyArray<VesselPredictionUpdates>> => {
  const predictionInputs = buildPredictionStageInputs(
    tripUpdates,
    trips,
    completedHandoffs
  );
  if (predictionInputs.changedTripUpdates.length === 0) {
    return [];
  }

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
 * Builds terminal-pair model-load requests for this prediction pass.
 *
 * @param activeTrips - Active trips from this ping
 * @param completedHandoffs - Completed rollover facts from the trip stage
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
    for (const modelType of modelTypesForTrip) {
      modelTypes.add(modelType);
    }
    requestMap.set(pairKey, modelTypes);
  }

  return [...requestMap.entries()].map(([pairKey, modelTypes]) => ({
    pairKey,
    modelTypes: [...modelTypes],
  }));
};

/**
 * Loads production ML model parameters needed for the current prediction pass.
 *
 * @param ctx - Convex action context for prediction model query
 * @param activeTrips - Active trips to evaluate this ping
 * @param completedHandoffs - Completed rollover handoffs from the trip stage
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
 * Creates memoized targeted schedule access for the current ping.
 *
 * @param ctx - Action context for `eventsScheduled` queries
 * @returns Cached schedule continuity access
 */
const createScheduleContinuityAccess = (
  ctx: ActionCtx
): ScheduleContinuityAccess => {
  const segmentCache = new Map<
    string,
    Promise<ConvexInferredScheduledSegment | null>
  >();
  const departureCache = new Map<
    string,
    Promise<ReadonlyArray<CompactScheduledDepartureEvent>>
  >();

  const getScheduledDeparturesForVesselAndSailingDay = async (
    vesselAbbrev: string,
    sailingDay: string
  ): Promise<ReadonlyArray<CompactScheduledDepartureEvent>> => {
    const cacheKey = `${vesselAbbrev}:${sailingDay}`;
    const cached = departureCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = ctx
      .runQuery(
        internal.functions.events.eventsScheduled.queries
          .getScheduledDockEventsForSailingDay,
        {
          vesselAbbrev,
          sailingDay,
        }
      )
      .then(compactDeparturesFromScheduledRows);
    departureCache.set(cacheKey, promise);
    return promise;
  };

  return {
    getScheduledDeparturesForVesselAndSailingDay,
    getScheduledSegmentByKey: async (
      scheduleKey: string
    ): Promise<ConvexInferredScheduledSegment | null> => {
      const cached = segmentCache.get(scheduleKey);
      if (cached) {
        return cached;
      }

      const promise = ctx
        .runQuery(
          internal.functions.events.eventsScheduled.queries
            .getScheduledDepartureEventBySegmentKey,
          { segmentKey: scheduleKey }
        )
        .then(async (departureRow) => {
          if (!departureRow) {
            return null;
          }

          const departures = await getScheduledDeparturesForVesselAndSailingDay(
            departureRow.VesselAbbrev,
            departureRow.SailingDay
          );
          const departureIndex = departures.findIndex(
            (departure) => departure.Key === departureRow.Key
          );
          const nextDeparture =
            departureIndex >= 0 ? departures[departureIndex + 1] : undefined;

          return {
            Key: scheduleKey,
            SailingDay: departureRow.SailingDay,
            DepartingTerminalAbbrev: departureRow.TerminalAbbrev,
            ArrivingTerminalAbbrev: departureRow.NextTerminalAbbrev,
            DepartingTime: departureRow.ScheduledDeparture,
            NextKey: nextDeparture
              ? getSegmentKeyFromBoundaryKey(nextDeparture.Key)
              : undefined,
            NextDepartingTime: nextDeparture?.ScheduledDeparture,
          };
        });
      segmentCache.set(scheduleKey, promise);
      return promise;
    },
  };
};

/**
 * Narrows scheduled dock rows to ordered departure summaries.
 *
 * @param rows - Scheduled dock rows for one vessel and sailing day
 * @returns Sorted departure-only rows used for continuity lookups
 */
const compactDeparturesFromScheduledRows = (
  rows: ReadonlyArray<ConvexScheduledDockEvent>
): ReadonlyArray<CompactScheduledDepartureEvent> =>
  rows
    .filter((row) => row.EventType === "dep-dock")
    .sort(
      (left, right) =>
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.TerminalAbbrev.localeCompare(right.TerminalAbbrev)
    )
    .map((row) => ({
      Key: row.Key,
      ScheduledDeparture: row.ScheduledDeparture,
      TerminalAbbrev: row.TerminalAbbrev,
    }));

/**
 * Logs an aggregated skip summary only when every location is unchanged.
 *
 * @param locationUpdates - All vessel location updates for the ping
 */
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

/**
 * Returns whether downstream prediction/timeline work should continue.
 *
 * @param tripUpdate - Per-vessel trip update
 * @returns True when durable trip facts changed
 */
const shouldContinueAfterTripUpdate = (tripUpdate: VesselTripUpdate): boolean =>
  tripUpdate.tripStorageChanged || tripUpdate.tripLifecycleChanged;

/**
 * Filters the trip stage down to the subset that needs prediction work.
 *
 * @param tripUpdates - Per-vessel trip updates
 * @param trips - Authoritative trip rows after the trip stage
 * @param completedHandoffs - Completed rollover handoffs from persistence planning
 * @returns Narrow prediction-stage inputs for changed vessels only
 */
const buildPredictionStageInputs = (
  tripUpdates: ReadonlyArray<VesselTripUpdate>,
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

/**
 * Builds the final persistence payload for one orchestrator ping.
 *
 * @param args - Stage outputs to merge into the single mutation payload
 * @returns Compact persistence bundle for `persistOrchestratorPing`
 */
const buildOrchestratorPersistenceBundle = ({
  pingStartedAt,
  locationUpdates,
  existingActiveTrips,
  tripStage,
  predictionUpdates,
}: BuildOrchestratorPersistenceBundleArgs): OrchestratorPingPersistence => ({
  pingStartedAt,
  changedLocations: [...changedLocationUpdatesFromUpdates(locationUpdates)],
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

/**
 * Extracts changed location writes for the persistence mutation.
 *
 * @param locationUpdates - Full location update set for the ping
 * @returns Changed rows plus optional existing document ids
 */
const changedLocationUpdatesFromUpdates = (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>
): ReadonlyArray<OrchestratorPingPersistence["changedLocations"][number]> =>
  locationUpdates
    .filter((update) => update.locationChanged)
    .map((update) => ({
      vesselLocation: update.vesselLocation,
      existingLocationId: update.existingLocationId,
    }));

/**
 * Groups batch prediction outputs back into per-vessel results.
 *
 * @param tripUpdates - Changed-vessel trip updates
 * @param predictionRows - Batch prediction proposal rows
 * @param predictedTripComputations - Batch timeline ML handoffs
 * @param completedHandoffs - Completed rollover handoffs keyed by vessel
 * @returns Per-vessel prediction outputs
 */
const buildPredictionUpdatesByVessel = (
  tripUpdates: ReadonlyArray<VesselTripUpdate>,
  predictionRows: ReadonlyArray<
    Awaited<
      ReturnType<typeof runVesselPredictionPing>
    >["predictionRows"][number]
  >,
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>,
  completedHandoffs: ReadonlyArray<CompletedTripBoundaryFact>
): ReadonlyArray<VesselPredictionUpdates> => {
  const vesselAbbrevs = new Set<string>([
    ...tripUpdates.map((update) => update.vesselLocation.VesselAbbrev),
    ...completedHandoffs.map((handoff) => handoff.tripToComplete.VesselAbbrev),
  ]);

  const predictionRowsByVessel = new Map<
    string,
    Array<(typeof predictionRows)[number]>
  >();
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
    predictedTripComputationsByVessel.set(
      computation.vesselAbbrev,
      computations
    );
  }

  const completedHandoffsByVessel = new Map<
    string,
    Array<CompletedTripBoundaryFact>
  >();
  for (const completedHandoff of completedHandoffs) {
    const vesselAbbrev = completedHandoff.tripToComplete.VesselAbbrev;
    const handoffs = completedHandoffsByVessel.get(vesselAbbrev) ?? [];
    handoffs.push(completedHandoff);
    completedHandoffsByVessel.set(vesselAbbrev, handoffs);
  }

  return [...vesselAbbrevs].map((vesselAbbrev) => ({
    vesselAbbrev,
    predictionRows: predictionRowsByVessel.get(vesselAbbrev) ?? [],
    predictedTripComputations:
      predictedTripComputationsByVessel.get(vesselAbbrev) ?? [],
    completedHandoffs: completedHandoffsByVessel.get(vesselAbbrev) ?? [],
  }));
};

/**
 * Flattens per-vessel prediction rows for persistence.
 *
 * @param predictionUpdates - Per-vessel prediction outputs
 * @returns Flat prediction proposal rows
 */
const mergePredictionRows = (
  predictionUpdates: ReadonlyArray<VesselPredictionUpdates>
): ReadonlyArray<VesselPredictionUpdates["predictionRows"][number]> =>
  predictionUpdates.flatMap(
    (predictionUpdate) => predictionUpdate.predictionRows
  );

/**
 * Flattens per-vessel timeline ML handoffs for persistence.
 *
 * @param predictionUpdates - Per-vessel prediction outputs
 * @returns Flat predicted-trip computations
 */
const mergePredictedTripComputations = (
  predictionUpdates: ReadonlyArray<VesselPredictionUpdates>
): ReadonlyArray<PredictedTripComputation> =>
  predictionUpdates.flatMap(
    (predictionUpdate) => predictionUpdate.predictedTripComputations
  );

export type { PredictionStageInputs };
export {
  buildOrchestratorPersistenceBundle,
  buildPredictionStageInputs,
  computeTripBatchForPing,
  logTripStageLocationSkipSummary,
  shouldContinueAfterTripUpdate,
};

/**
 * Backward-compatible helper for focused tests that still provide a snapshot.
 *
 * @param locationUpdates - Location updates for the ping
 * @param existingActiveTrips - Active trips from storage
 * @param scheduleSnapshot - In-memory schedule snapshot for tests
 * @param sailingDay - Sailing day represented by the snapshot
 * @returns Trip updates and authoritative trip rows for the ping
 */
const computeTripBatchForPing = async (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleSnapshot: ScheduleSnapshot,
  sailingDay: string
): Promise<{
  updates: ReadonlyArray<VesselTripUpdate>;
  rows: RunUpdateVesselTripsOutput;
}> => {
  const tripStage = await computeTripStageForLocations(
    locationUpdates.filter((update) => update.locationChanged),
    existingActiveTrips,
    createScheduleContinuityAccessFromSnapshot(scheduleSnapshot, sailingDay)
  );

  return {
    updates: tripStage.tripUpdates,
    rows: tripStage.tripRows,
  };
};
