/**
 * Partitioning types for per-vessel prepared updates inside `updateVesselTrips`.
 */

import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/** One realtime row plus optional prior trip and detected lifecycle events. */
export type PreparedTripUpdate = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  events: TripEvents;
};

/** Prepared update that is guaranteed to have a prior active trip (completion path). */
export type CompletedTripUpdate = PreparedTripUpdate & {
  existingActiveTrip: ConvexVesselTrip;
};

/** Split of completing vs continuing vessels plus which vessels appeared in-feed. */
export type TripUpdatePartition = {
  completedTripUpdates: ReadonlyArray<CompletedTripUpdate>;
  activeTripUpdates: ReadonlyArray<PreparedTripUpdate>;
  seenRealtimeVessels: ReadonlySet<string>;
};
