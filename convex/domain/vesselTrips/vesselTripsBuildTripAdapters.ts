/**
 * Injected function-layer behaviors for {@link buildTrip}.
 *
 * `resolveEffectiveLocation` and `appendFinalSchedule` stay under
 * `convex/functions/` until Phase 3; domain lifecycle code receives them via
 * {@link ProcessVesselTripsDeps.buildTripAdapters}.
 */

import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Function-layer hooks required to assemble one enriched trip proposal.
 */
export type VesselTripsBuildTripAdapters = {
  resolveEffectiveLocation: (
    ctx: ActionCtx,
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTrip | undefined
  ) => Promise<ConvexVesselLocation>;
  appendFinalSchedule: (
    ctx: ActionCtx,
    baseTrip: ConvexVesselTrip,
    existingTrip: ConvexVesselTrip | undefined
  ) => Promise<ConvexVesselTrip>;
};
