/**
 * Build completed trip with TripEnd, durations, and actualized predictions.
 *
 * Adds TripEnd, AtSeaDuration, TotalDuration, and same-trip prediction actuals
 * to the persisted completed trip object.
 */

import { actualizePredictionsOnTripComplete } from "domain/ml/prediction";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";

// ============================================================================
// buildCompletedTrip
// ============================================================================

/**
 * Build completed trip with TripEnd, AtSeaDuration, and TotalDuration.
 *
 * Adds TripEnd, AtSeaDuration, TotalDuration, and same-trip prediction actuals
 * to the final completed trip.
 *
 * @param existingTrip - Trip being completed
 * @param currLocation - Current location with TripEnd timestamp
 * @returns Completed trip with all completion fields set
 */
export const buildCompletedTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): ConvexVesselTrip => {
  const effectiveArrivalTime =
    existingTrip.ArriveDock ?? currLocation.TimeStamp;
  const withTripEnd = { ...existingTrip, TripEnd: currLocation.TimeStamp };
  const withDurations = {
    ...withTripEnd,
    AtSeaDuration: calculateTimeDelta(
      withTripEnd.LeftDock,
      effectiveArrivalTime
    ),
    TotalDuration: calculateTimeDelta(
      withTripEnd.TripStart,
      effectiveArrivalTime
    ),
  };

  return actualizePredictionsOnTripComplete(withDurations);
};
