/**
 * Pure trip-update pipeline.
 */

import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./contracts";
import { createTripUpdateRuntime } from "./createTripUpdateRuntime";
import { finalizeCompletedTrips } from "./finalizeCompletedTrips";
import { prepareTripUpdates } from "./prepareTripUpdates";
import { updateActiveTrips } from "./updateActiveTrips";

export const runUpdateVesselTrips = async (
  input: RunUpdateVesselTripsInput
): Promise<RunUpdateVesselTripsOutput> => {
  const runtime = createTripUpdateRuntime(input);
  const preparedUpdates = prepareTripUpdates(input, runtime);
  const completedTripResolutions = await finalizeCompletedTrips(
    preparedUpdates.completedTripUpdates,
    runtime
  );
  const updatedActiveTrips = await updateActiveTrips(
    preparedUpdates.activeTripUpdates,
    runtime
  );

  const processedActiveTrips = [
    ...completedTripResolutions.flatMap((resolution) =>
      resolution.activeVesselTrip !== undefined
        ? [resolution.activeVesselTrip]
        : []
    ),
    ...updatedActiveTrips,
  ];

  return {
    completedVesselTrips: completedTripResolutions.flatMap((resolution) =>
      resolution.completedVesselTrip !== undefined
        ? [resolution.completedVesselTrip]
        : []
    ),
    activeVesselTrips: mergeActiveTripRows(
      input.existingActiveTrips,
      preparedUpdates.seenRealtimeVessels,
      processedActiveTrips
    ),
  };
};

const mergeActiveTripRows = (
  existingActiveTrips: ReadonlyArray<RunUpdateVesselTripsInput["existingActiveTrips"][number]>,
  seenRealtimeVessels: ReadonlySet<string>,
  processedActiveTrips: ReadonlyArray<RunUpdateVesselTripsOutput["activeVesselTrips"][number]>
): ReadonlyArray<RunUpdateVesselTripsOutput["activeVesselTrips"][number]> => {
  const processedTripsByVessel = new Map(
    processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const mergedActiveTrips: RunUpdateVesselTripsOutput["activeVesselTrips"][number][] =
    [];
  const includedVessels = new Set<string>();

  for (const existingTrip of existingActiveTrips) {
    const processedTrip = processedTripsByVessel.get(existingTrip.VesselAbbrev);
    if (processedTrip !== undefined) {
      mergedActiveTrips.push(processedTrip);
      includedVessels.add(existingTrip.VesselAbbrev);
      continue;
    }

    if (!seenRealtimeVessels.has(existingTrip.VesselAbbrev)) {
      mergedActiveTrips.push(existingTrip);
      includedVessels.add(existingTrip.VesselAbbrev);
    }
  }

  for (const processedTrip of processedActiveTrips) {
    if (includedVessels.has(processedTrip.VesselAbbrev)) {
      continue;
    }
    mergedActiveTrips.push(processedTrip);
    includedVessels.add(processedTrip.VesselAbbrev);
  }

  return mergedActiveTrips;
};
