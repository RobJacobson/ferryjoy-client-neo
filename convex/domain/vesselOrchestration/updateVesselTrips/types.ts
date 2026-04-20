import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type PreparedTripUpdate = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  events: TripEvents;
};

export type CompletedTripUpdate = PreparedTripUpdate & {
  existingActiveTrip: ConvexVesselTrip;
};

export type TripUpdatePartition = {
  completedTripUpdates: ReadonlyArray<CompletedTripUpdate>;
  activeTripUpdates: ReadonlyArray<PreparedTripUpdate>;
  seenRealtimeVessels: ReadonlySet<string>;
};
