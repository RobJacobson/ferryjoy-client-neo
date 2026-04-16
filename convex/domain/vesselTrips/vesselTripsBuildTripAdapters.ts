/**
 * Injected boundary adapters for {@link buildTrip}.
 *
 * Schedule continuity decisions live in `domain/vesselTrips/continuity/`; these
 * hooks remain narrow Convex adapters (`ctx.runQuery` / internal queries) wired
 * by {@link ProcessVesselTripsDeps.buildTripAdapters}.
 */

import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";

/**
 * Boundary hooks required to assemble one enriched trip proposal.
 */
export type VesselTripsBuildTripAdapters = {
  resolveEffectiveLocation: (
    ctx: ActionCtx,
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTripWithPredictions | undefined
  ) => Promise<ConvexVesselLocation>;
  appendFinalSchedule: (
    ctx: ActionCtx,
    baseTrip: ConvexVesselTripWithPredictions,
    existingTrip: ConvexVesselTripWithPredictions | undefined
  ) => Promise<ConvexVesselTripWithPredictions>;
};
