/**
 * Injected boundary adapters for {@link buildTrip}.
 *
 * Schedule continuity decisions live in `domain/vesselTrips/continuity/`; these
 * hooks remain narrow Convex adapters (`ctx.runQuery` / internal queries) wired
 * by {@link ProcessVesselTripsDeps.buildTripAdapters}.
 */

import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Boundary hooks required to assemble one enriched trip proposal.
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
