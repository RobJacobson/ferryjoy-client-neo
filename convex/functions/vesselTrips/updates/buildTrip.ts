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

const THROTTLE_TIME_SECONDS = 5;

/**
 * Build complete vessel trip from raw location data with all enrichments.
 *
 * Handles building, schedule lookups, and ML predictions in one place:
 * - Calls baseTripFromLocation for base trip
 * - Uses provided events for enrichment decisions
 * - Runs appropriate schedule lookups and predictions (event-driven + time-based fallback)
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

  // Time-based throttle: check predictions once per minute (first 5 seconds of each minute)
  const currentSeconds = new Date(Date.now()).getSeconds();
  const shouldAttemptAtDockPredictions =
    events.didJustArriveAtDock || currentSeconds < THROTTLE_TIME_SECONDS;
  const shouldAttemptAtSeaPredictions =
    events.didJustLeaveDock || currentSeconds < THROTTLE_TIME_SECONDS;

  // At dock predictions (AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext)
  // Run when at dock AND (just arrived OR throttled time check) AND at least one prediction is missing
  if (
    baseTrip.AtDock &&
    !baseTrip.LeftDock &&
    shouldAttemptAtDockPredictions &&
    (!baseTrip.AtDockDepartCurr ||
      !baseTrip.AtDockArriveNext ||
      !baseTrip.AtDockDepartNext)
  ) {
    enrichedTrip = await appendArriveDockPredictions(ctx, enrichedTrip);
  }

  // At sea predictions (AtSeaArriveNext, AtSeaDepartNext)
  // Run when at sea AND (just left OR throttled time check) AND at least one prediction is missing
  if (
    !baseTrip.AtDock &&
    baseTrip.LeftDock &&
    shouldAttemptAtSeaPredictions &&
    (!baseTrip.AtSeaArriveNext || !baseTrip.AtSeaDepartNext)
  ) {
    enrichedTrip = await appendLeaveDockPredictions(ctx, enrichedTrip);
  }

  return enrichedTrip;
};
