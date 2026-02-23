// ============================================================================
// Build Trip With Predictions
// Adds ML predictions to vessel trips when event-triggered
// ============================================================================

import type { ActionCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { computeVesselTripPredictionsPatch } from "../../../domain/ml/prediction/vesselTripPredictions";

/**
 * Add predictions to a trip when event-triggered (arrive-dock, depart-dock).
 *
 * @param ctx - Convex action context for running ML predictions
 * @param trip - Current vessel trip state
 * @param existingTrip - Previous vessel trip state (for detecting events)
 * @returns Trip with prediction fields applied
 */
export const buildTripWithPredictions = async (
  ctx: ActionCtx,
  trip: ConvexVesselTrip,
  existingTrip?: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  const patch = await computeVesselTripPredictionsPatch(
    ctx,
    trip,
    existingTrip
  );
  return { ...trip, ...patch };
};
