/**
 * Injected boundary adapters for {@link buildTripCore}.
 *
 * Schedule continuity helpers live in `continuity/`; the trip pipeline supplies
 * concrete `resolveEffectiveLocation` and `appendFinalSchedule` (see
 * `createTripUpdateRuntime` for default wiring).
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Boundary hooks required to assemble one enriched trip proposal.
 */
export type VesselTripsBuildTripAdapters = {
  resolveEffectiveLocation: (
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTrip | undefined
  ) => Promise<ConvexVesselLocation>;
  appendFinalSchedule: (
    baseTrip: ConvexVesselTrip,
    existingTrip: ConvexVesselTrip | undefined
  ) => Promise<ConvexVesselTrip>;
};
