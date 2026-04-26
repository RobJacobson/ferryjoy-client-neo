/**
 * Vessel orchestrator actions.
 *
 * The hot path keeps one baseline snapshot query, one WSF fetch, a per-vessel
 * trip loop over the normalized feed for this tick, one locations-only
 * mutation, and one trip/prediction/timeline persistence mutation per ping.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { v } from "convex/values";
import type {
  PersistedTripTimelineHandoff,
  CompletedArrivalHandoff,
  ScheduleContinuityAccess,
} from "domain/vesselOrchestration/shared";
import type {
  RunUpdateVesselTripsOutput,
  VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrips";
import { computeVesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";
import { runUpdateVesselTimelineFromAssembly } from "domain/vesselOrchestration/updateTimeline";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  buildVesselTripWrites,
  type VesselTripWrites,
} from "functions/vesselOrchestrator/persistVesselTripWriteSet";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  ENABLE_ORCHESTRATOR_SANITY_METRICS,
  ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS,
  ORCHESTRATOR_SANITY_SCHEDULE_LOG_EVENT,
} from "./constants";
import { loadVesselLocationUpdates } from "./locationUpdates";
import {
  buildPredictionStageInputs,
  runPredictionStage,
} from "./predictionStage";
import {
  createScheduleContinuityAccess,
  type ScheduleContinuityMetricsSummary,
} from "./scheduleContinuityAccess";

type OrchestratorSnapshot = {
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
};

type TripStageResult = {
  tripWrites: VesselTripWrites;
  predictionInputs: {
    activeTrips: ReadonlyArray<ConvexVesselTrip>;
    completedHandoffs: ReadonlyArray<CompletedArrivalHandoff>;
  };
};

const CRITICAL_PER_VESSEL_FAILURE_PREFIX =
  "[VESSEL_ORCHESTRATOR_CRITICAL_PER_VESSEL_FAILURE]";

/**
 * Internal action: load identity and active trips, fetch live locations, and
 * persist one orchestrator ping.
 *
 * @returns Nothing; logs and rethrows on failure
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    try {
      await runOrchestratorPing(ctx);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[updateVesselOrchestrator]", err);
      throw err;
    }
    return null;
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
    terminalsIdentity: snapshot.terminalsIdentity,
    vesselsIdentity: snapshot.vesselsIdentity,
  });
  const dedupedLocationUpdates = await ctx.runMutation(
    api.functions.vesselLocation.mutations.bulkUpsertVesselLocations,
    {
      locations: Array.from(locationUpdates),
    }
  );
  const scheduleAccess = createScheduleContinuityAccess(ctx);

  const tripStageResult = await computeTripStageForLocations(
    dedupedLocationUpdates,
    snapshot.activeTrips,
    scheduleAccess
  );
  const predictionStageResult = await runPredictionStage(
    ctx,
    tripStageResult.predictionInputs
  );
  const tripHandoffForTimeline = await persistTripAndPredictionStages(
    ctx,
    tripStageResult.tripWrites,
    predictionStageResult.predictionRows
  );
  const { actualEvents, predictedEvents } = runUpdateVesselTimelineFromAssembly({
    pingStartedAt,
    tripHandoffForTimeline,
    mlTimelineOverlays: predictionStageResult.mlTimelineOverlays,
  });
  logScheduleContinuitySanitySummary(
    pingStartedAt,
    scheduleAccess.getMetricsSummary()
  );

  await ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.persistTimelineEventWrites,
    {
      actualEvents,
      predictedEvents,
    }
  );
};

/**
 * Persists changed trip and prediction rows, then returns timeline handoff data.
 *
 * @param ctx - Convex action context for mutation calls
 * @param tripWrites - Planned trip-table writes for this ping
 * @param predictionRows - Prediction upserts for changed trips
 * @returns Trip handoff used by timeline assembly in action memory
 */
const persistTripAndPredictionStages = async (
  ctx: ActionCtx,
  tripWrites: VesselTripWrites,
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>
): Promise<PersistedTripTimelineHandoff> => {
  const persisted = await ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.persistTripAndPredictionWrites,
    {
      tripWrites,
      predictionRows: Array.from(predictionRows),
    }
  );

  return {
    completedFacts: persisted.completedFacts,
    currentBranch: {
      successfulVessels: new Set(persisted.currentBranch.successfulVessels),
      pendingActualMessages: persisted.currentBranch.pendingActualMessages,
      pendingPredictedMessages: persisted.currentBranch.pendingPredictedMessages,
    },
  };
};

/**
 * Loads the baseline read model required for one orchestrator ping.
 *
 * @param ctx - Convex action context for internal snapshot query
 * @returns Identity tables and active trips
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
 * Computes trip updates for each supplied location update using schedule access.
 *
 * @param locationUpdates - Normalized live locations for this ping
 * @param existingActiveTrips - Active-trip snapshot from ping start
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Trip rows plus prediction-stage inputs for downstream work
 */
export const computeTripStageForLocations = async (
  locationUpdates: ReadonlyArray<ConvexVesselLocation>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleAccess: ScheduleContinuityAccess
): Promise<TripStageResult> => {
  const activeTripsByVesselAbbrev = new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const completedTripRows: Array<ConvexVesselTrip> = [];
  const tripUpdates: Array<VesselTripUpdate> = [];

  for (const vesselLocation of locationUpdates) {
    const vesselAbbrev = vesselLocation.VesselAbbrev;
    const existingActiveTrip = activeTripsByVesselAbbrev.get(vesselAbbrev);
    let tripUpdate: VesselTripUpdate;

    try {
      tripUpdate = await computeVesselTripUpdate({
        vesselLocation,
        existingActiveTrip,
        scheduleAccess,
      });
    } catch (error) {
      logCriticalPerVesselTripStageFailure({
        vesselLocation,
        existingActiveTrip,
        error,
      });
      continue;
    }

    tripUpdates.push(tripUpdate);

    if (tripUpdate.completedTrip) {
      completedTripRows.push(tripUpdate.completedTrip);
    }

    if (tripUpdate.activeTripCandidate) {
      activeTripsByVesselAbbrev.set(
        vesselAbbrev,
        tripUpdate.activeTripCandidate
      );
      continue;
    }

    if (tripUpdate.existingActiveTrip) {
      activeTripsByVesselAbbrev.delete(vesselAbbrev);
    }
  }

  const tripRows: RunUpdateVesselTripsOutput = {
    activeTrips: [...activeTripsByVesselAbbrev.values()],
    completedTrips: completedTripRows,
  };
  const tripWrites = buildVesselTripWrites(
    tripRows,
    existingActiveTrips
  );

  return {
    tripWrites,
    predictionInputs: buildPredictionStageInputs(
      tripUpdates,
      tripWrites.completedTripWrites
    ),
  };
};

const logScheduleContinuitySanitySummary = (
  pingStartedAt: number,
  summary: ScheduleContinuityMetricsSummary | null
): void => {
  if (
    !ENABLE_ORCHESTRATOR_SANITY_METRICS ||
    !ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS ||
    summary === null
  ) {
    return;
  }

  console.info(ORCHESTRATOR_SANITY_SCHEDULE_LOG_EVENT, {
    pingStartedAt,
    ...summary,
  });
};

/**
 * Logs a critical per-vessel trip-stage failure without stopping the fleet ping.
 *
 * @param args - Vessel location, active-trip context, and thrown failure
 */
const logCriticalPerVesselTripStageFailure = ({
  vesselLocation,
  existingActiveTrip,
  error,
}: {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  error: unknown;
}): void => {
  const err = error instanceof Error ? error : new Error(String(error));

  console.error(CRITICAL_PER_VESSEL_FAILURE_PREFIX, {
    vesselAbbrev: vesselLocation.VesselAbbrev,
    locationTimeStamp: vesselLocation.TimeStamp,
    routeAbbrev: vesselLocation.RouteAbbrev,
    departingTerminalAbbrev: vesselLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: vesselLocation.ArrivingTerminalAbbrev,
    existingTripKey: existingActiveTrip?.TripKey,
    existingScheduleKey: existingActiveTrip?.ScheduleKey,
    message: err.message,
    stack: err.stack,
  });
};
