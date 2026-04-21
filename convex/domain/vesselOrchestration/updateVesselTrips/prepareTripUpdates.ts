/**
 * Maps each vessel location to detected events and partitions completing trips.
 */

import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";
import type {
  PreparedTripUpdate,
  TripUpdatePartition,
} from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Builds one prepared update per realtime row and splits completion vs active paths.
 *
 * @param vesselLocations - Live feed rows for this batch (one prepared row each)
 * @param existingActiveTrips - Prior active trips keyed by overlap with feed vessels
 * @returns Completing updates plus non-completing updates for active projection
 */
export const prepareTripUpdates = (
  vesselLocations: ReadonlyArray<ConvexVesselLocation>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): TripUpdatePartition => {
  const existingTripsByVessel: Partial<Record<string, ConvexVesselTrip>> =
    Object.fromEntries(
      existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip])
    );

  // One prepared row per feed vessel: join prior active trip and detect events.
  const preparedUpdates: PreparedTripUpdate[] = vesselLocations.map((vl) => {
    const existingActiveTrip = existingTripsByVessel[vl.VesselAbbrev];

    return {
      vesselLocation: vl,
      existingActiveTrip,
      events: detectTripEvents(existingActiveTrip, vl),
    };
  });

  // Completion path: arrival signaled and an existing trip row exists to close.
  // Rows with `isCompletedTrip` but no prior active are intentionally omitted
  // (cannot close a trip we are not tracking).
  const completedTripUpdates = preparedUpdates.filter(
    (update): update is TripUpdatePartition["completedTripUpdates"][number] =>
      update.events.isCompletedTrip && update.existingActiveTrip !== undefined
  );

  return {
    completedTripUpdates,
    // Non-completing pings stay on the active path (includes open sea legs).
    activeTripUpdates: preparedUpdates.filter(
      (update) => !update.events.isCompletedTrip
    ),
  };
};
