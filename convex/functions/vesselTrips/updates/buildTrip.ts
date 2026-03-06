/**
 * Build complete vessel trip from raw location data with all enrichments.
 */
import type { ActionCtx } from "_generated/server";
import { actualizePredictionsOnLeaveDock } from "domain/ml/prediction";
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
 * - Runs appropriate schedule lookups and predictions (event-driven + time-based fallback)
 * - Applies same-trip prediction actuals before persistence on leave-dock events
 * - Returns fully enriched trip ready for persistence
 *
 * @param ctx - Convex action context
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Previous trip for event detection (undefined for new trips)
 * @param tripStart - True for new trip (boundary or first), false for continuing
 * @param events - Detected trip events from detectTripEvents
 * @param shouldRunPredictionFallback - True when this tick should attempt
 * any missing fallback predictions
 * @returns Fully enriched vessel trip
 */
export const buildTrip = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  shouldRunPredictionFallback: boolean
): Promise<ConvexVesselTrip> => {
  // Build base trip from raw location data
  const baseTrip = baseTripFromLocation(currLocation, existingTrip, tripStart);

  // Start with base trip
  let enrichedTrip = baseTrip;

  // Event: Arrive at dock with missing ArrivingTerminal - lookup destination terminal
  if (events.didJustArriveAtDock && !baseTrip.ArrivingTerminalAbbrev) {
    enrichedTrip = await appendInitialSchedule(ctx, enrichedTrip);
  }

  // Event: Key changed - lookup full schedule by trip key
  if (events.keyChanged) {
    enrichedTrip = await appendFinalSchedule(ctx, enrichedTrip, existingTrip);
  }

  // Check if we should attempt predictions (event-driven or time-based fallback)
  const shouldAttemptAtDockPredictions =
    events.didJustArriveAtDock || shouldRunPredictionFallback;
  const shouldAttemptAtSeaPredictions =
    events.didJustLeaveDock || shouldRunPredictionFallback;

  // At dock predictions: run when at dock (not departed) and missing predictions
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

  // At sea predictions: run when at sea (has LeftDock) and missing predictions
  if (
    !baseTrip.AtDock &&
    baseTrip.LeftDock &&
    shouldAttemptAtSeaPredictions &&
    (!baseTrip.AtSeaArriveNext || !baseTrip.AtSeaDepartNext)
  ) {
    enrichedTrip = await appendLeaveDockPredictions(ctx, enrichedTrip);
  }

  // Actualize same-trip predictions when vessel just left dock
  return events.didJustLeaveDock
    ? actualizePredictionsOnLeaveDock(enrichedTrip)
    : enrichedTrip;
};
