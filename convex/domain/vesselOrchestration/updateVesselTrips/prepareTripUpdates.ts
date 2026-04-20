import type { RunUpdateVesselTripsInput } from "domain/vesselOrchestration/updateVesselTrips/contracts";
import type { TripUpdateRuntime } from "domain/vesselOrchestration/updateVesselTrips/createTripUpdateRuntime";
import type {
  PreparedTripUpdate,
  TripUpdatePartition,
} from "domain/vesselOrchestration/updateVesselTrips/types";

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

  const completedTripUpdates = preparedUpdates.filter(
    (update): update is TripUpdatePartition["completedTripUpdates"][number] =>
      update.events.isCompletedTrip && update.existingActiveTrip !== undefined
  );

  return {
    completedTripUpdates,
    activeTripUpdates: preparedUpdates.filter(
      (update) => !update.events.isCompletedTrip
    ),
    seenRealtimeVessels: new Set(
      input.vesselLocations.map((inputRow) => inputRow.VesselAbbrev)
    ),
  };
};
