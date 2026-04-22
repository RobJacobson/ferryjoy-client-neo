/**
 * Types for the pure `updateVesselTrips` pipeline: public runner I/O
 * (`RunUpdateVesselTripsInput` / `RunUpdateVesselTripsOutput`), intermediate
 * {@link CalculatedTripUpdate}, and per-ping row outcomes {@link VesselPingTripRows}.
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
 * Canonical Stage 2 per-vessel change bundle for the orchestrator pipeline.
 *
 * `activeTripCandidate` is the storage-shaped active row that would represent
 * this vessel after the ping. `replacementTrip` is populated only when the ping
 * closes a prior trip and starts a new active trip in the same pass.
 */
export type VesselTripUpdates = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  activeTripCandidate?: ConvexVesselTrip;
  completedTrip?: ConvexVesselTrip;
  replacementTrip?: ConvexVesselTrip;
  tripStorageChanged: boolean;
  tripLifecycleChanged: boolean;
};

/**
 * One feed row joined with optional prior active trip and {@link TripEvents}.
 *
 * Produced by {@link calculatedTripUpdateForFeedRow}; consumed by
 * {@link tripRowsForVesselPing}.
 */
export type CalculatedTripUpdate = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  events: TripEvents;
};

/**
 * {@link CalculatedTripUpdate} with a definite prior active row.
 *
 * Required to emit a completed trip close in {@link tripRowsForVesselPing}.
 */
export type CompletedTripUpdate = CalculatedTripUpdate & {
  existingActiveTrip: ConvexVesselTrip;
};

/**
 * Optional stored rows produced for one vessel on one ping (table names align
 * with `completedVesselTrips` / `activeVesselTrips`).
 *
 * A completion with a closable prior yields both; a continuing trip yields only
 * `activeVesselTrip`; a completion signal without a prior active yields neither
 * (same ping contributes nothing).
 */
export type VesselPingTripRows = {
  completedVesselTrip?: ConvexVesselTrip;
  activeVesselTrip?: ConvexVesselTrip;
};
