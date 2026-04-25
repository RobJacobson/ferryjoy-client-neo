/**
 * Vessel orchestrator actions.
 *
 * The hot path keeps one baseline snapshot query, one WSF fetch, a per-vessel
 * trip loop over the normalized feed for this tick, and one persistence
 * mutation per ping.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import { v } from "convex/values";
import type {
  CompletedArrivalHandoff,
  ScheduleContinuityAccess,
} from "domain/vesselOrchestration/shared";
import type {
  RunUpdateVesselTripsOutput,
  VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrips";
import { computeVesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import { buildVesselTripPersistencePlan } from "functions/vesselOrchestrator/persistVesselTripWriteSet";
import type { VesselLocationUpdates } from "functions/vesselOrchestrator/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  feedLocationsFromUpdates,
  loadVesselLocationUpdates,
} from "./locationUpdates";
import { buildOrchestratorPersistenceBundle } from "./persistenceBundle";
import {
  buildPredictionStageInputs,
  runPredictionStage,
} from "./predictionStage";
import { createScheduleContinuityAccess } from "./scheduleContinuityAccess";

type OrchestratorSnapshot = {
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
};

type TripStageResult = {
  tripRows: RunUpdateVesselTripsOutput;
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
    pingStartedAt,
    terminalsIdentity: snapshot.terminalsIdentity,
    vesselsIdentity: snapshot.vesselsIdentity,
  });
  const scheduleAccess = createScheduleContinuityAccess(ctx);

  const tripStage = await computeTripStageForLocations(
    locationUpdates,
    snapshot.activeTrips,
    scheduleAccess
  );
  const predictionStage = await runPredictionStage(
    ctx,
    tripStage.predictionInputs
  );

  await ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.persistOrchestratorPing,
    buildOrchestratorPersistenceBundle({
      pingStartedAt,
      feedLocations: feedLocationsFromUpdates(locationUpdates),
      existingActiveTrips: snapshot.activeTrips,
      tripRows: tripStage.tripRows,
      predictionRows: predictionStage.predictionRows,
      mlTimelineOverlays: predictionStage.mlTimelineOverlays,
    })
  );
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
  locationUpdates: ReadonlyArray<VesselLocationUpdates>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleAccess: ScheduleContinuityAccess
): Promise<TripStageResult> => {
  const activeTripsByVessel = new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const completedTrips: Array<ConvexVesselTrip> = [];
  const tripUpdates: Array<VesselTripUpdate> = [];

  for (const locationUpdate of locationUpdates) {
    const vesselAbbrev = locationUpdate.vesselLocation.VesselAbbrev;
    const existingActiveTrip = activeTripsByVessel.get(vesselAbbrev);
    let tripUpdate: VesselTripUpdate;

    try {
      tripUpdate = await computeVesselTripUpdate({
        vesselLocation: locationUpdate.vesselLocation,
        existingActiveTrip,
        scheduleAccess,
      });
    } catch (error) {
      logCriticalPerVesselTripStageFailure({
        locationUpdate,
        existingActiveTrip,
        error,
      });
      continue;
    }

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
    tripRows,
    predictionInputs: buildPredictionStageInputs(
      tripUpdates,
      attemptedCompletedFacts
    ),
  };
};

/**
 * Logs a critical per-vessel trip-stage failure without stopping the fleet ping.
 *
 * @param args - Vessel location, active-trip context, and thrown failure
 */
const logCriticalPerVesselTripStageFailure = ({
  locationUpdate,
  existingActiveTrip,
  error,
}: {
  locationUpdate: VesselLocationUpdates;
  existingActiveTrip?: ConvexVesselTrip;
  error: unknown;
}): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  const { vesselLocation } = locationUpdate;

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
