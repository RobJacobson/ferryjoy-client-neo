/**
 * Pure trip-update pipeline: prepare → complete → active → merge with carry-forward.
 */

import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./contracts";
import { createTripPipelineDeps } from "./createTripPipelineDeps";
import { finalizeCompletedTrips } from "./finalizeCompletedTrips";
import { prepareTripUpdates } from "./prepareTripUpdates";
import { updateActiveTrips } from "./updateActiveTrips";

/**
 * Runs one orchestrator tick: derives completed rows and merged active trips.
 */
export const runUpdateVesselTrips = (
  input: RunUpdateVesselTripsInput
): RunUpdateVesselTripsOutput => {
  const deps = createTripPipelineDeps(input);
  const prepared = prepareTripUpdates(input, deps);

  const completionResolutions = finalizeCompletedTrips(
    prepared.completedTripUpdates,
    deps
  );
  const continuingActives = updateActiveTrips(prepared.activeTripUpdates, deps);

  const processedActiveTrips = [
    ...completionResolutions.flatMap((resolution) =>
      resolution.replacementActiveTrip !== undefined
        ? [resolution.replacementActiveTrip]
        : []
    ),
    ...continuingActives,
  ];

  return {
    completedTrips: completionResolutions.flatMap((resolution) =>
      resolution.completedVesselTrip !== undefined
        ? [resolution.completedVesselTrip]
        : []
    ),
    activeTrips: mergeActiveTripRows(
      input.existingActiveTrips,
      prepared.seenRealtimeVessels,
      processedActiveTrips
    ),
  };
};

/**
 * Merges new/updated actives with prior rows for vessels missing from this batch.
 */
const mergeActiveTripRows = (
  existingActiveTrips: ReadonlyArray<
    RunUpdateVesselTripsInput["existingActiveTrips"][number]
  >,
  seenRealtimeVessels: ReadonlySet<string>,
  processedActiveTrips: ReadonlyArray<
    RunUpdateVesselTripsOutput["activeTrips"][number]
  >
): ReadonlyArray<RunUpdateVesselTripsOutput["activeTrips"][number]> => {
  const processedTripsByVessel = new Map(
    processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const mergedActiveTrips: RunUpdateVesselTripsOutput["activeTrips"][number][] =
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
