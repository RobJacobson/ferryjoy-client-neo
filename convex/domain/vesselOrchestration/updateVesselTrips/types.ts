/**
 * Types for the pure `updateVesselTrips` pipeline: public runner I/O
 * (`RunUpdateVesselTripsInput` / `RunUpdateVesselTripsOutput`) and intermediate
 * shapes from {@link calculateTripUpdates} through {@link TripUpdatesRouting}.
 */

import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEventTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Arguments for {@link computeVesselTripsRows}: one feed batch plus schedule
 * snapshot for segment lookups.
 */
export type RunUpdateVesselTripsInput = {
  vesselLocations: ReadonlyArray<ConvexVesselLocation>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  scheduleSnapshot: ScheduleSnapshot;
  /** Sailing day for this ping (matches {@link getScheduleSnapshotForPing}). */
  sailingDay: string;
};

/**
 * Pure pipeline output: trips completed this ping and the merged authoritative
 * active set (including vessels not in the batch).
 */
export type RunUpdateVesselTripsOutput = {
  /** Authoritative active rows after this ping (names align with `functions/vesselTrips`). */
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  completedTrips: ReadonlyArray<ConvexVesselTrip>;
};

/**
 * One feed row joined with optional prior active trip and {@link TripEvents}.
 *
 * Produced by {@link calculateTripUpdates}; consumed when building or routing
 * trip rows.
 */
export type CalculatedTripUpdate = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  events: TripEvents;
};

/**
 * {@link CalculatedTripUpdate} with a definite prior active row.
 *
 * Required to emit a completed trip close in {@link finalizeCompletedTrips}.
 */
export type CompletedTripUpdate = CalculatedTripUpdate & {
  existingActiveTrip: ConvexVesselTrip;
};

/**
 * Same batch of {@link CalculatedTripUpdate} rows split for pipeline branches.
 *
 * Output of {@link calculateUpdatedVesselTrips} (and {@link prepareTripUpdates}).
 */
export type TripUpdatesRouting = {
  completedTripUpdates: ReadonlyArray<CompletedTripUpdate>;
  activeTripUpdates: ReadonlyArray<CalculatedTripUpdate>;
};
