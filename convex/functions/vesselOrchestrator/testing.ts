/**
 * Focused vessel-orchestrator test helpers.
 *
 * This keeps compatibility helpers out of the production orchestrator action
 * so the hot-path file stays centered on real runtime concerns.
 */

import { internal } from "_generated/api";
import type { Id } from "_generated/dataModel";
import type { ActionCtx } from "_generated/server";
import { createScheduleContinuityAccessFromSnapshot } from "domain/vesselOrchestration/shared";
import type {
  PredictedTripComputation,
} from "domain/vesselOrchestration/shared";
import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";
import { computeVesselTripsBatch } from "domain/vesselOrchestration/updateVesselTrips";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  OrchestratorPingPersistence,
  VesselLocationUpdates,
  VesselTripUpdate,
} from "functions/vesselOrchestrator/schemas";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  buildChangedLocationWrites,
  loadVesselLocationUpdates,
} from "./locationUpdates";

type BuildOrchestratorPersistenceBundleArgs = {
  pingStartedAt: number;
  changedLocations: ReadonlyArray<{
    vesselLocation: ConvexVesselLocation;
    existingLocationId?: Id<"vesselLocations">;
  }>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  tripRows: RunUpdateVesselTripsOutput;
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>;
};

/**
 * Backward-compatible helper for focused location tests.
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
  const snapshot = await ctx.runQuery(
    internal.functions.vesselOrchestrator.queries.getOrchestratorModelData
  );
  const locationUpdates = await loadVesselLocationUpdates({
    pingStartedAt,
    storedLocations: snapshot.storedLocations,
    terminalsIdentity,
    vesselsIdentity,
  });
  const changedLocations = buildChangedLocationWrites(
    locationUpdates.filter((update) => update.locationChanged)
  );

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
 * Backward-compatible helper for focused tests that still provide a snapshot.
 *
 * @param locationUpdates - Location updates for the ping
 * @param existingActiveTrips - Active trips from storage
 * @param scheduleSnapshot - In-memory schedule snapshot for tests
 * @param sailingDay - Sailing day represented by the snapshot
 * @returns Trip updates and authoritative trip rows for the ping
 */
export const computeTripBatchForPing = async (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  scheduleSnapshot: ScheduleSnapshot,
  sailingDay: string
): Promise<{
  updates: ReadonlyArray<VesselTripUpdate>;
  rows: RunUpdateVesselTripsOutput;
}> =>
  computeVesselTripsBatch({
    vesselLocations: locationUpdates
      .filter((update) => update.locationChanged)
      .map((update) => update.vesselLocation),
    existingActiveTrips,
    scheduleAccess: createScheduleContinuityAccessFromSnapshot(
      scheduleSnapshot,
      sailingDay
    ),
  });

/**
 * Test helper that mirrors the runtime persistence payload assembly.
 *
 * @param args - Stage outputs to merge into one persistence payload
 * @returns Compact persistence bundle for `persistOrchestratorPing`
 */
export const buildOrchestratorPersistenceBundle = ({
  pingStartedAt,
  changedLocations,
  existingActiveTrips,
  tripRows,
  predictionRows,
  predictedTripComputations,
}: BuildOrchestratorPersistenceBundleArgs): OrchestratorPingPersistence => {
  return {
    pingStartedAt,
    changedLocations: [...changedLocations],
    existingActiveTrips: [...existingActiveTrips],
    tripRows: {
      activeTrips: [...tripRows.activeTrips],
      completedTrips: [...tripRows.completedTrips],
    },
    predictionRows: [...predictionRows],
    predictedTripComputations: [...predictedTripComputations],
  };
};
