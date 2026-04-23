/**
 * Shared contracts for the pure `updateVesselTrips` pipeline.
 */

import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Arguments for the trip batch runner: one feed batch plus schedule
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
