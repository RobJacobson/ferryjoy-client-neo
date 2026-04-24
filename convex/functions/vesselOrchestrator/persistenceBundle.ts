/**
 * Shared persistence-bundle assembly for vessel-orchestrator writes.
 *
 * Runtime actions and focused tests both build the same compact payload for
 * `persistOrchestratorPing`, so this helper keeps that shape in one place.
 */

import type { PredictedTripComputation } from "domain/vesselOrchestration/shared";
import type { RunUpdateVesselTripsOutput } from "domain/vesselOrchestration/updateVesselTrips";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { ChangedLocationWrite } from "./locationUpdates";
import type { OrchestratorPingPersistence } from "./schemas";

type BuildOrchestratorPersistenceBundleArgs = {
  pingStartedAt: number;
  changedLocations: ReadonlyArray<ChangedLocationWrite>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  tripRows: RunUpdateVesselTripsOutput;
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>;
  predictedTripComputations: ReadonlyArray<PredictedTripComputation>;
};

/**
 * Builds the final persistence payload for one orchestrator ping.
 *
 * @param args - Stage outputs to merge into the single mutation payload
 * @returns Compact persistence bundle for `persistOrchestratorPing`
 */
export const buildOrchestratorPersistenceBundle = ({
  pingStartedAt,
  changedLocations,
  existingActiveTrips,
  tripRows,
  predictionRows,
  predictedTripComputations,
}: BuildOrchestratorPersistenceBundleArgs): OrchestratorPingPersistence => ({
  pingStartedAt,
  changedLocations: [...changedLocations],
  existingActiveTrips: [...existingActiveTrips],
  tripRows: {
    activeTrips: [...tripRows.activeTrips],
    completedTrips: [...tripRows.completedTrips],
  },
  predictionRows: [...predictionRows],
  predictedTripComputations: [...predictedTripComputations],
});
