/**
 * Injected boundary adapters for {@link buildTripCore}.
 *
 * Schedule continuity helpers live in `continuity/`; the trip pipeline supplies
 * concrete `resolveEffectiveLocation` and `appendFinalSchedule` (see
 * `createTripPipelineDeps` for default wiring).
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Schedule continuity hooks for {@link buildTripCore} (pure, synchronous).
 */
export type VesselTripsBuildTripAdapters = {
  resolveEffectiveLocation: (
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTrip | undefined
  ) => ConvexVesselLocation;
  appendFinalSchedule: (
    baseTrip: ConvexVesselTrip,
    existingTrip: ConvexVesselTrip | undefined
  ) => ConvexVesselTrip;
};
