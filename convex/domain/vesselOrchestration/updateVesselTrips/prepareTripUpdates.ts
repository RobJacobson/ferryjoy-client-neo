/**
 * Maps each vessel location to detected events and partitions completing trips.
 */

import type { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";
import type {
  PreparedTripUpdate,
  RunUpdateVesselTripsInput,
  TripUpdatePartition,
} from "domain/vesselOrchestration/updateVesselTrips/types";

/**
 * Builds one prepared update per realtime row and splits completion vs active paths.
 *
 * @param input - Live locations and existing active trips for overlap lookup
 * @param deps - Provides `detectTripEvents` for each prepared row
 * @returns Completing updates plus non-completing updates for active projection
 */
export const prepareTripUpdates = (
  input: Pick<
    RunUpdateVesselTripsInput,
    "vesselLocations" | "existingActiveTrips"
  >,
  detectEvents: typeof detectTripEvents
): TripUpdatePartition => {
  const existingTripsByVessel = new Map(
    input.existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

  // One prepared row per feed vessel: join prior active trip and detect events.
  const preparedUpdates: PreparedTripUpdate[] = input.vesselLocations.map(
    (vesselLocation) => {
      const existingActiveTrip = existingTripsByVessel.get(
        vesselLocation.VesselAbbrev
      );

      return {
        vesselLocation,
        existingActiveTrip,
        events: detectEvents(existingActiveTrip, vesselLocation),
      };
    }
  );

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
