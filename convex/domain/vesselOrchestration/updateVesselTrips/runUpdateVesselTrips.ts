/**
 * Canonical trips runner: adapt the internal trip compute into the concern-owned
 * public trips contract without routing the public story through persistence helpers.
 */

import { createScheduledSegmentLookupFromSnapshot } from "domain/vesselOrchestration/shared";
import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./contracts";
import { createDefaultProcessVesselTripsDeps } from "./processTick/defaultProcessVesselTripsDeps";
import { computeVesselTripsBundle } from "./processTick/processVesselTrips";
import type { VesselTripsComputeBundle } from "./tripLifecycle/vesselTripsComputeBundle";

type UpdateVesselTripsTickArtifacts = {
  trips: RunUpdateVesselTripsOutput;
  bundle: VesselTripsComputeBundle;
};

export const computeUpdateVesselTripsTickArtifacts = async (
  input: RunUpdateVesselTripsInput
): Promise<UpdateVesselTripsTickArtifacts> => {
  const tripDeps = createDefaultProcessVesselTripsDeps(
    createScheduledSegmentLookupFromSnapshot(input.scheduleContext)
  );
  const { bundle } = await computeVesselTripsBundle(
    input.vesselLocations,
    tripDeps,
    input.existingActiveTrips
  );
  const trips = {
    activeTrips: [
      ...bundle.completedHandoffs.map(
        (handoff) => handoff.newTripCore.withFinalSchedule
      ),
      ...bundle.current.activeUpserts,
    ],
    completedTrips: bundle.completedHandoffs.map(
      (handoff) => handoff.tripToComplete
    ),
  };

  return {
    trips,
    bundle,
  };
};

/**
 * Stage A canonical public runner for the trips concern.
 *
 * This is a thin wrapper over the legacy compute pipeline. It freezes the
 * public contract while preserving the existing internal lifecycle flow.
 */
export const runUpdateVesselTrips = async (
  input: RunUpdateVesselTripsInput
): Promise<RunUpdateVesselTripsOutput> => {
  const { trips } = await computeUpdateVesselTripsTickArtifacts(input);
  return trips;
};
