/**
 * Maps each vessel location to detected events and partitions completing trips.
 */

import type { RunUpdateVesselTripsInput } from "domain/vesselOrchestration/updateVesselTrips/contracts";
import type { TripUpdateRuntime } from "domain/vesselOrchestration/updateVesselTrips/createTripUpdateRuntime";
import type {
  PreparedTripUpdate,
  TripUpdatePartition,
} from "domain/vesselOrchestration/updateVesselTrips/types";

/**
 * Builds one prepared update per realtime row and splits completion vs active paths.
 *
 * @param input - Live locations and existing active trips for overlap lookup
 * @param runtime - Provides `detectTripEvents` for each prepared row
 * @returns Completing updates, continuing updates, and vessels seen this tick
 */
export const prepareTripUpdates = (
  input: Pick<
    RunUpdateVesselTripsInput,
    "vesselLocations" | "existingActiveTrips"
  >,
  runtime: Pick<TripUpdateRuntime, "detectTripEvents">
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
        events: runtime.detectTripEvents(existingActiveTrip, vesselLocation),
      };
    }
  );

  // Completion path: arrival signaled and an existing trip row exists to close.
  const completedTripUpdates = preparedUpdates.filter(
    (update): update is TripUpdatePartition["completedTripUpdates"][number] =>
      update.events.isCompletedTrip && update.existingActiveTrip !== undefined
  );

  return {
    completedTripUpdates,
    // Non-completing ticks stay on the active path (includes open sea legs).
    activeTripUpdates: preparedUpdates.filter(
      (update) => !update.events.isCompletedTrip
    ),
    seenRealtimeVessels: new Set(
      input.vesselLocations.map((inputRow) => inputRow.VesselAbbrev)
    ),
  };
};
