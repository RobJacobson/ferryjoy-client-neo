// ============================================================================
// ETA UPDATE ON DEPARTURE (depart-arrive-atsea-duration model)
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { MODEL_TYPES } from "../../shared/core/modelTypes";
import { makePrediction } from "./shared";
import type { PredictionResult } from "./types";

/**
 * Update ETA prediction when vessel departs from dock
 *
 * This function refines the ETA prediction using the depart-arrive-atsea-duration model
 * with the actual time the vessel spent at dock. Called when a vessel leaves dock
 * to provide more accurate arrival time predictions.
 *
 * @param ctx - Convex action or mutation context for database access
 * @param currentTrip - The current trip being executed
 * @param currentLocation - Current vessel location data including actual departure time
 * @returns Updated prediction result with refined ETA timestamp and model accuracy (MAE)
 */
export const predictEtaOnDeparture = async (
  ctx: ActionCtx | MutationCtx,
  currentTrip: ConvexVesselTrip
): Promise<PredictionResult> => {
  // Validate required data
  if (
    !currentTrip.ArrivingTerminalAbbrev ||
    !currentTrip?.LeftDock ||
    !currentTrip?.AtDockDuration ||
    !currentTrip?.TripDelay ||
    !currentTrip?.ScheduledDeparture
  ) {
    return {};
  }

  return makePrediction(
    ctx,
    MODEL_TYPES.DEPART_ARRIVE_ATSEA_DURATION,
    currentTrip,
    currentTrip.LeftDock
  );
};
