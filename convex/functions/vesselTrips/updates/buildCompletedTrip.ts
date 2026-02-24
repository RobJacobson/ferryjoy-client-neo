/**
 * Build completed trip with TripEnd, durations, and actualized predictions.
 *
 * Adds TripEnd, AtSeaDuration, TotalDuration to existing trip and
 * actualizes predictions (AtDockDepartCurr, AtSeaArriveNext).
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";

// ============================================================================
// buildCompletedTrip
// ============================================================================

/**
 * Build completed trip with TripEnd, AtSeaDuration, and TotalDuration.
 *
 * Adds TripEnd, AtSeaDuration, TotalDuration to existing trip.
 * Prediction actualization is handled separately by the prediction service.
 *
 * @param existingTrip - Trip being completed
 * @param currLocation - Current location with TripEnd timestamp
 * @returns Completed trip with all completion fields set
 */
export const buildCompletedTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): ConvexVesselTrip => {
  const completedTripBase: ConvexVesselTrip = {
    ...existingTrip,
    TripEnd: currLocation.TimeStamp,
  };

  completedTripBase.AtSeaDuration = calculateTimeDelta(
    completedTripBase.LeftDock,
    completedTripBase.TripEnd
  );

  completedTripBase.TotalDuration = calculateTimeDelta(
    completedTripBase.TripStart,
    completedTripBase.TripEnd
  );

  return completedTripBase;
};
