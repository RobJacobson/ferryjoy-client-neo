// ============================================================================
// LEFT DOCK PREDICTION (arrive-depart-delay model)
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { MODEL_TYPES } from "../../shared/core/modelTypes";
import { makePrediction } from "./shared";
import type { PredictionResult } from "./types";

/**
 * Predict departure delay for a new trip using the arrive-depart-delay model
 *
 * This function predicts how many minutes early or late a vessel will depart
 * relative to its scheduled departure time. Used when a vessel arrives at dock
 * and a new trip is about to start.
 *
 * @param ctx - Convex action or mutation context for database access
 * @param completedTrip - The trip that just completed (provides PrevTripDelay, PrevAtSeaDuration)
 * @param newTrip - The new trip to predict delay for
 * @returns Prediction result with delay in minutes and model accuracy (MAE)
 */
export const predictDelayOnArrival = async (
  ctx: ActionCtx | MutationCtx,
  newTrip: ConvexVesselTrip
): Promise<PredictionResult> => {
  // Validate required data
  if (
    !newTrip.ArrivingTerminalAbbrev ||
    !newTrip.ScheduledDeparture ||
    !newTrip.DepartingTerminalAbbrev ||
    !newTrip.TripStart ||
    !newTrip.PrevTripDelay ||
    !newTrip.PrevAtSeaDuration
  ) {
    return {};
  }

  // For delay prediction, we return raw delay minutes (not a timestamp)
  // Use baseTime === 0 to signal that this is a delay prediction, not a timestamp
  return makePrediction(
    ctx,
    MODEL_TYPES.ARRIVE_DEPART_DELAY,
    newTrip,
    0 // baseTime: 0 means return raw delay minutes
  );
};
