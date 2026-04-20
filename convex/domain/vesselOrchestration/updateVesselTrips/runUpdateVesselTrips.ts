/**
 * Pure trip-update pipeline: prepare → complete → active → merge with carry-forward.
 */

import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./contracts";
import { createTripUpdateRuntime } from "./createTripUpdateRuntime";
import { finalizeCompletedTrips } from "./finalizeCompletedTrips";
import { prepareTripUpdates } from "./prepareTripUpdates";
import { updateActiveTrips } from "./updateActiveTrips";

/**
 * Runs one orchestrator tick: derives completed rows and merged active trips.
 *
 * @param input - Realtime locations, prior actives, and schedule snapshot
 * @returns Completed trips from this tick plus full active trip set for persistence
 */
export const runUpdateVesselTrips = async (
  input: RunUpdateVesselTripsInput
): Promise<RunUpdateVesselTripsOutput> => {
  // Wire schedule lookups, then prepare one row per feed vessel (events + partition).
  const runtime = createTripUpdateRuntime(input);
  const preparedUpdates = prepareTripUpdates(input, runtime);
  // Close completing legs; each resolution may include the replacement active trip.
  const completedTripResolutions = await finalizeCompletedTrips(
    preparedUpdates.completedTripUpdates,
    runtime
  );
  // Project actives for vessels still in an open trip this tick.
  const updatedActiveTrips = await updateActiveTrips(
    preparedUpdates.activeTripUpdates,
    runtime
  );

  // Follow-on active rows from completions, then rows from non-completing updates.
  const processedActiveTrips = [
    ...completedTripResolutions.flatMap((resolution) =>
      resolution.activeVesselTrip !== undefined
        ? [resolution.activeVesselTrip]
        : []
    ),
    ...updatedActiveTrips,
  ];

  return {
    // Completed rows only; rejected finalizations omit an entry here.
    completedVesselTrips: completedTripResolutions.flatMap((resolution) =>
      resolution.completedVesselTrip !== undefined
        ? [resolution.completedVesselTrip]
        : []
    ),
    // Authoritative active set: merge processed rows with carry-forward rules.
    activeVesselTrips: mergeActiveTripRows(
      input.existingActiveTrips,
      preparedUpdates.seenRealtimeVessels,
      processedActiveTrips
    ),
  };
};

/**
 * Merges new/updated actives with prior rows for vessels missing from this batch.
 *
 * @param existingActiveTrips - Prior active trips (all vessels)
 * @param seenRealtimeVessels - Vessels present in this tick's location input
 * @param processedActiveTrips - Rows produced by completion + active update paths
 * @returns Stable active set: processed rows win; others carried if not in batch
 */
const mergeActiveTripRows = (
  existingActiveTrips: ReadonlyArray<
    RunUpdateVesselTripsInput["existingActiveTrips"][number]
  >,
  seenRealtimeVessels: ReadonlySet<string>,
  processedActiveTrips: ReadonlyArray<
    RunUpdateVesselTripsOutput["activeVesselTrips"][number]
  >
): ReadonlyArray<RunUpdateVesselTripsOutput["activeVesselTrips"][number]> => {
  const processedTripsByVessel = new Map(
    processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
  const mergedActiveTrips: RunUpdateVesselTripsOutput["activeVesselTrips"][number][] =
    [];
  const includedVessels = new Set<string>();

  for (const existingTrip of existingActiveTrips) {
    const processedTrip = processedTripsByVessel.get(existingTrip.VesselAbbrev);
    // Prefer this tick's built row over the stale snapshot when both exist.
    if (processedTrip !== undefined) {
      mergedActiveTrips.push(processedTrip);
      includedVessels.add(existingTrip.VesselAbbrev);
      continue;
    }

    // No row this tick: keep prior active only if the vessel had no realtime row.
    if (!seenRealtimeVessels.has(existingTrip.VesselAbbrev)) {
      mergedActiveTrips.push(existingTrip);
      includedVessels.add(existingTrip.VesselAbbrev);
    }
  }

  // Append brand-new actives (e.g. first appearance) not present in `existing`.
  for (const processedTrip of processedActiveTrips) {
    if (includedVessels.has(processedTrip.VesselAbbrev)) {
      continue;
    }
    mergedActiveTrips.push(processedTrip);
    includedVessels.add(processedTrip.VesselAbbrev);
  }

  return mergedActiveTrips;
};
