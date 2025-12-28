// ============================================================================
// ETA PREDICTION ON NEW TRIP (arrive-arrive-total-duration model)
// ============================================================================

/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { MODEL_TYPES } from "../../shared/core/modelTypes";
import { featureExtractors, makePrediction, timeConverters } from "./shared";
import type { PredictionResult } from "./types";

/**
 * Predict ETA for a new trip using the arrive-arrive-total-duration model
 *
 * This function predicts the absolute arrival time for a new trip by modeling
 * the total duration from vessel arrival at dock to arrival at the next terminal.
 * Used when a vessel arrives at dock and a new trip is about to start.
 *
 * @param ctx - Convex action or mutation context for database access
 * @param completedTrip - The trip that just completed (provides context for the new trip)
 * @param newTrip - The new trip that is about to start
 * @returns Prediction result with ETA timestamp and model accuracy (MAE)
 */
export const predictEtaOnArrival = async (
  ctx: ActionCtx | MutationCtx,
  completedTrip: ConvexVesselTrip,
  newTrip: ConvexVesselTrip
): Promise<PredictionResult> => {
  // Validate required data
  if (
    !completedTrip?.Delay ||
    !completedTrip?.AtSeaDuration ||
    !newTrip?.TripStart ||
    !newTrip?.ScheduledDeparture
  ) {
    throw new Error("Insufficient data for ETA prediction on arrival");
  }

  const features = featureExtractors.arrivalBased({
    departingTerminal: newTrip.DepartingTerminalAbbrev,
    arrivingTerminal: newTrip.ArrivingTerminalAbbrev || "",
    scheduledDeparture: newTrip.ScheduledDeparture,
    prevDelay: completedTrip.Delay,
    prevAtSeaDuration: completedTrip.AtSeaDuration,
    tripStart: newTrip.TripStart,
  });

  return makePrediction(
    ctx,
    MODEL_TYPES.ARRIVE_ARRIVE_TOTAL_DURATION,
    newTrip.DepartingTerminalAbbrev,
    newTrip.ArrivingTerminalAbbrev || "",
    features,
    (duration) => timeConverters.combinedToArrival(duration, newTrip.TripStart!)
  );
};
