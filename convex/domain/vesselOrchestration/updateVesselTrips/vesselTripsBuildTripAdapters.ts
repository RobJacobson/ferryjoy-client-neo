/**
 * Injected boundary adapters for {@link buildTrip}.
 *
 * Schedule continuity decisions live in `domain/vesselOrchestration/updateVesselTrips/continuity/`; these
 * hooks use {@link ScheduledSegmentLookup} wired by the functions layer via
 * {@link ProcessVesselTripsDeps.buildTripAdapters}.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";

/**
 * Boundary hooks required to assemble one enriched trip proposal.
 */
export type VesselTripsBuildTripAdapters = {
  resolveEffectiveLocation: (
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTripWithPredictions | undefined
  ) => Promise<ConvexVesselLocation>;
  appendFinalSchedule: (
    baseTrip: ConvexVesselTripWithPredictions,
    existingTrip: ConvexVesselTripWithPredictions | undefined
  ) => Promise<ConvexVesselTripWithPredictions>;
};
