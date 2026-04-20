/**
 * Types for the pure `updateVesselTrips` pipeline:
 * - public I/O (`RunUpdateVesselTripsInput` / `RunUpdateVesselTripsOutput`)
 * - internal partitioning of per-vessel updates.
 */

import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/** Arguments for {@link computeVesselTripsRows}: one feed batch plus schedule snapshot. */
export type RunUpdateVesselTripsInput = {
  vesselLocations: ReadonlyArray<ConvexVesselLocation>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  scheduleContext: ScheduleSnapshot;
};

/** Pure pipeline output: trips completed this ping and the merged active set. */
export type RunUpdateVesselTripsOutput = {
  /** Authoritative active rows after this ping (names align with `functions/vesselTrips`). */
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  completedTrips: ReadonlyArray<ConvexVesselTrip>;
};

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

/** Split of completing vs continuing vessels for one realtime batch. */
export type TripUpdatePartition = {
  completedTripUpdates: ReadonlyArray<CompletedTripUpdate>;
  activeTripUpdates: ReadonlyArray<PreparedTripUpdate>;
};
