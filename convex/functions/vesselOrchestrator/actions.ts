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
import type { Infer } from "convex/values";
import type { ScheduleContinuityAccess } from "domain/vesselOrchestration/shared";
import type {
  RunUpdateVesselTripsOutput,
  VesselTripUpdate,
} from "domain/vesselOrchestration/updateVesselTrips";
import { computeVesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import { buildVesselTripPersistencePlan } from "functions/vesselOrchestrator/persistVesselTripWriteSet";
import type {
  storedVesselLocationSchema,
  VesselLocationUpdates,
} from "functions/vesselOrchestrator/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  buildChangedLocationWrites,
  type ChangedLocationWrite,
  loadVesselLocationUpdates,
} from "./locationUpdates";
import {
  buildPredictionStageInputs,
  type PredictionStageInputs,
  type PredictionStageResult,
  runPredictionStage,
} from "./predictionStage";
import { createScheduleContinuityAccess } from "./scheduleContinuityAccess";
import type { OrchestratorPingPersistence } from "./schemas";

type StoredVesselLocation = Infer<typeof storedVesselLocationSchema>;

type OrchestratorSnapshot = {
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  storedLocations: ReadonlyArray<StoredVesselLocation>;
};

type TripStageResult = {
  tripRows: RunUpdateVesselTripsOutput;
  predictionInputs: PredictionStageInputs;
};

type BuildOrchestratorPersistenceBundleArgs = {
  pingStartedAt: number;
  changedLocations: ReadonlyArray<ChangedLocationWrite>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  tripStage: TripStageResult;
  predictionStage: PredictionStageResult;
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
  const changedLocationUpdates = locationUpdates.filter(
    (update) => update.locationChanged
  );
  if (changedLocationUpdates.length === 0) {
    return;
  }
  const changedLocations = buildChangedLocationWrites(changedLocationUpdates);

  const tripStage = await computeTripStageForLocations(
    changedLocationUpdates,
    snapshot.activeTrips,
    createScheduleContinuityAccess(ctx)
  );
  const predictionStage = await runPredictionStage(
    ctx,
    tripStage.predictionInputs
  );

  await ctx.runMutation(
    internal.functions.vesselOrchestrator.mutations.persistOrchestratorPing,
    buildOrchestratorPersistenceBundle({
      pingStartedAt,
      changedLocations,
      existingActiveTrips: snapshot.activeTrips,
      tripStage,
      predictionStage,
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
 * Computes trip updates for a changed-vessel subset using the provided schedule access.
 *
 * @param changedLocationUpdates - Changed live locations for this ping
 * @param existingActiveTrips - Active-trip snapshot from ping start
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Trip rows plus prediction-stage inputs for downstream work
 */
const computeTripStageForLocations = async (
  changedLocationUpdates: ReadonlyArray<VesselLocationUpdates>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleAccess: ScheduleContinuityAccess
): Promise<TripStageResult> => {
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
    tripRows,
    predictionInputs: buildPredictionStageInputs(
      tripUpdates,
      attemptedCompletedFacts
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
  changedLocations,
  existingActiveTrips,
  tripStage,
  predictionStage,
}: BuildOrchestratorPersistenceBundleArgs): OrchestratorPingPersistence => ({
  pingStartedAt,
  changedLocations: [...changedLocations],
  existingActiveTrips: [...existingActiveTrips],
  tripRows: {
    activeTrips: [...tripStage.tripRows.activeTrips],
    completedTrips: [...tripStage.tripRows.completedTrips],
  },
  predictionRows: [...predictionStage.predictionRows],
  predictedTripComputations: [...predictionStage.predictedTripComputations],
});
