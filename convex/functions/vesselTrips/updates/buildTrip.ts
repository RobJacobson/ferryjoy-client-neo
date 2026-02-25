/**
 * Build complete vessel trip from raw location data with all enrichments.
 */
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  appendArriveDockPredictions,
  appendLeaveDockPredictions,
} from "./appendPredictions";
import { appendFinalSchedule, appendInitialSchedule } from "./appendSchedule";
import { baseTripFromLocation } from "./baseTripFromLocation";
import type { TripEvents } from "./eventDetection";

/**
 * Build complete vessel trip from raw location data with all enrichments.
 *
 * Handles building, schedule lookups, and ML predictions in one place:
 * - Calls baseTripFromLocation for base trip
 * - Uses provided events for enrichment decisions
 * - Runs appropriate schedule lookups and predictions
 * - Returns fully enriched trip ready for persistence
 *
 * @param ctx - Convex action context
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Previous trip for event detection (undefined for new trips)
 * @param tripStart - True for new trip (boundary or first), false for continuing
 * @param events - Detected trip events from detectTripEvents
 * @returns Fully enriched vessel trip
 */
export const buildTrip = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents
): Promise<ConvexVesselTrip> => {
  // Build base trip from raw data
  const baseTrip = baseTripFromLocation(currLocation, existingTrip, tripStart);

  let enrichedTrip = baseTrip;

  // Event: Arrive at dock (schedule lookup for arriving terminal)
  if (events.didJustArriveAtDock && !baseTrip.ArrivingTerminalAbbrev) {
    enrichedTrip = await appendInitialSchedule(ctx, enrichedTrip);
  }

  // Event: Key changed or have departure info (schedule lookup by Key)
  if (events.keyChanged) {
    enrichedTrip = await appendFinalSchedule(ctx, enrichedTrip, existingTrip);
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
