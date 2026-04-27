/**
 * Shared contracts for the pure `updateVesselTrip` pipeline.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

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
