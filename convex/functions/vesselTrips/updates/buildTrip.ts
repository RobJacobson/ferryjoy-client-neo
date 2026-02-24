/**
 * Build complete vessel trip from raw location data with all enrichments.
 */
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { baseTripFromLocation } from "./baseTripFromLocation";
import {
  appendArriveDockPredictions,
  appendLeaveDockPredictions,
} from "./appendPredictions";
import {
  appendFinalSchedule,
  appendInitialSchedule,
} from "./appendSchedule";
import { detectTripEvents } from "./eventDetection";

/**
 * Build complete vessel trip from raw location data with all enrichments.
 *
 * Handles building, schedule lookups, and ML predictions in one place:
 * - Calls baseTripFromLocation for base trip
 * - Detects events using centralized event detection
 * - Runs appropriate schedule lookups and predictions
 * - Returns fully enriched trip ready for persistence
 *
 * @param ctx - Convex action context
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Previous trip for event detection (undefined for new trips)
 * @param tripStart - True for new trip (boundary or first), false for continuing
 * @returns Fully enriched vessel trip
 */
export const buildTrip = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean
): Promise<ConvexVesselTrip> => {
  // Build base trip from raw data
  const baseTrip = baseTripFromLocation(
    currLocation,
    existingTrip,
    tripStart
  );

  // Detect events using centralized event detection
  const events = detectTripEvents(existingTrip, currLocation);

  let enrichedTrip = baseTrip;

  // Event: Arrive at dock (schedule lookup for arriving terminal)
  if (events.didJustArriveAtDock && !baseTrip.ArrivingTerminalAbbrev) {
    enrichedTrip = await appendInitialSchedule(ctx, baseTrip);
  }

  // Event: Key changed or have departure info (schedule lookup by Key)
  if (events.keyChanged) {
    enrichedTrip = await appendFinalSchedule(
      ctx,
      baseTrip,
      existingTrip
    );
  }

  // Event: Arrive at dock (at-dock predictions)
  if (events.didJustArriveAtDock) {
    enrichedTrip = await appendArriveDockPredictions(ctx, enrichedTrip);
  }

  // Event: Leave dock (leave-dock predictions)
  if (events.didJustLeaveDock) {
    enrichedTrip = await appendLeaveDockPredictions(ctx, enrichedTrip);
  }

  return enrichedTrip;
};
