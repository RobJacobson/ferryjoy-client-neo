/**
 * Build complete vessel trip from raw location data with all enrichments.
 */
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildTripFromVesselLocation } from "./buildTripFromVesselLocation";
import {
  buildTripWithArriveDockPredictions,
  buildTripWithLeaveDockPredictions,
} from "./buildTripWithPredictions";
import {
  buildTripWithFinalSchedule,
  buildTripWithInitialSchedule,
} from "./buildTripWithSchedule";

/**
 * Build complete vessel trip from raw location data with all enrichments.
 *
 * Handles building, schedule lookups, and ML predictions in one place:
 * - Calls buildTripFromVesselLocation for base trip
 * - Detects events (arrive-dock, depart-dock, key changed)
 * - Runs appropriate schedule lookups and predictions
 * - Returns fully enriched trip ready for persistence
 *
 * @param ctx - Convex action context
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Previous trip for event detection (undefined for new trips)
 * @param completedTrip - Completed trip at boundary (provides Prev* for new trip)
 * @returns Fully enriched vessel trip
 */
export const buildTrip = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean
): Promise<ConvexVesselTrip> => {
  // Build base trip from raw data
  const baseTrip = buildTripFromVesselLocation(
    currLocation,
    existingTrip,
    tripStart
  );

  // Detect events
  const didJustArriveAtDock =
    existingTrip && !existingTrip.AtDock && baseTrip.AtDock;
  const didJustLeaveDock =
    existingTrip?.LeftDock === undefined && baseTrip.LeftDock !== undefined;
  const keyChanged =
    existingTrip?.Key !== undefined && baseTrip.Key !== existingTrip.Key;

  let enrichedTrip = baseTrip;

  // Event: Arrive at dock (schedule lookup for arriving terminal)
  if (didJustArriveAtDock && !baseTrip.ArrivingTerminalAbbrev) {
    enrichedTrip = await buildTripWithInitialSchedule(ctx, enrichedTrip);
    console.log("Arrived at dock", enrichedTrip);
  }

  // Event: Key changed or have departure info (schedule lookup by Key)
  if (keyChanged) {
    enrichedTrip = await buildTripWithFinalSchedule(
      ctx,
      enrichedTrip,
      existingTrip
    );
    console.log("Key changed", enrichedTrip);
  }

  // Event: Arrive at dock (at-dock predictions)
  if (didJustArriveAtDock) {
    enrichedTrip = await buildTripWithArriveDockPredictions(ctx, enrichedTrip);
  }

  // Event: Leave dock (leave-dock predictions)
  if (didJustLeaveDock) {
    enrichedTrip = await buildTripWithLeaveDockPredictions(ctx, enrichedTrip);
  }

  return enrichedTrip;
};
