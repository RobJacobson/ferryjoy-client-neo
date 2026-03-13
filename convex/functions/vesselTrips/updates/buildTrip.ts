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
import { appendFinalSchedule } from "./appendSchedule";
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
  const baseTrip = baseTripFromLocation(currLocation, existingTrip, tripStart);
  const withArriveDest = {
    ...baseTrip,
    ArriveDest:
      baseTrip.ArriveDest ??
      (!tripStart && events.didJustArriveAtDock
        ? currLocation.TimeStamp
        : undefined),
  };

  // Compute enrichment conditions
  const shouldAppendFinalSchedule = tripStart || events.keyChanged;
  const shouldAttemptAtDockPredictions =
    withArriveDest.AtDock &&
    !withArriveDest.LeftDock &&
    Boolean(withArriveDest.TripStart) &&
    (tripStart || shouldRunPredictionFallback) &&
    (!withArriveDest.AtDockDepartCurr ||
      !withArriveDest.AtDockArriveNext ||
      !withArriveDest.AtDockDepartNext);
  const shouldAttemptAtSeaPredictions =
    !withArriveDest.AtDock &&
    Boolean(withArriveDest.LeftDock) &&
    (events.didJustLeaveDock || shouldRunPredictionFallback) &&
    (!withArriveDest.AtSeaArriveNext || !withArriveDest.AtSeaDepartNext);

  // Sequential enrichment pipeline
  const withFinalSchedule = shouldAppendFinalSchedule
    ? await appendFinalSchedule(ctx, withArriveDest, existingTrip)
    : withArriveDest;
  const withAtDockPredictions = shouldAttemptAtDockPredictions
    ? await appendArriveDockPredictions(ctx, withFinalSchedule)
    : withFinalSchedule;
  const withAtSeaPredictions = shouldAttemptAtSeaPredictions
    ? await appendLeaveDockPredictions(ctx, withAtDockPredictions)
    : withAtDockPredictions;

  return events.didJustLeaveDock
    ? actualizePredictionsOnLeaveDock(withAtSeaPredictions)
    : withAtSeaPredictions;
};
