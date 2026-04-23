/**
 * Per-vessel stage outputs for the orchestrator action pipeline.
 *
 * These types keep the hot path explicit where the action genuinely branches by
 * vessel, while persistence handoffs stay in the lean batch-native shapes the
 * mutation already expects.
 */

export type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";

import type { Id } from "_generated/dataModel";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

/**
 * Canonical single-vessel output for the location stage
 * ({@link computeVesselLocationRows} plus orchestrator-side change detection).
 */
export type VesselLocationUpdates = {
  vesselLocation: ConvexVesselLocation;
  existingLocationId?: Id<"vesselLocations">;
  locationChanged: boolean;
};
