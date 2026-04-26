/**
 * Shared contracts for the pure `updateVesselTrips` pipeline.
 */

import type { ScheduleContinuityAccess } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Arguments for the trip batch runner: one feed batch plus narrow schedule
 * continuity access for targeted lookups.
 */
export type RunUpdateVesselTripsInput = {
  vesselLocations: ReadonlyArray<ConvexVesselLocation>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  scheduleAccess: ScheduleContinuityAccess;
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
 * Canonical Stage 2 per-vessel write intents for the orchestrator pipeline.
 *
 * Each field represents a concrete storage update to apply. When a field is
 * undefined, no write should be emitted for that table/branch.
 */
export type VesselTripUpdate = {
  vesselAbbrev: ConvexVesselLocation["VesselAbbrev"];
  activeVesselTripUpdate?: ConvexVesselTrip;
  completedVesselTripUpdate?: ConvexVesselTrip;
};
