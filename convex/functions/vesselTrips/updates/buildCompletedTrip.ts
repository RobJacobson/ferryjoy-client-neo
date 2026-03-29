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
  const effectiveArrivalTime = getEffectiveArrivalTime(
    existingTrip,
    currLocation.TimeStamp
  );
  const withTripEnd = {
    ...existingTrip,
    ArriveDest: effectiveArrivalTime,
    TripEnd: currLocation.TimeStamp,
  };
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

/**
 * Choose a safe arrival timestamp for trip completion.
 *
 * Falls back to the current tick when the carried `ArriveDest` is missing or
 * would place arrival before the trip started or left dock.
 *
 * @param existingTrip - Trip being completed
 * @param fallbackArrivalTime - Current tick timestamp in epoch milliseconds
 * @returns Arrival timestamp safe to persist on the completed trip
 */
const getEffectiveArrivalTime = (
  existingTrip: ConvexVesselTrip,
  fallbackArrivalTime: number
): number => {
  const candidateArrivalTime = existingTrip.ArriveDest;

  if (candidateArrivalTime === undefined) {
    return fallbackArrivalTime;
  }

  if (
    (existingTrip.LeftDock !== undefined &&
      candidateArrivalTime < existingTrip.LeftDock) ||
    (existingTrip.TripStart !== undefined &&
      candidateArrivalTime < existingTrip.TripStart)
  ) {
    // Guard against stale feed values that would make the trip go backward.
    return fallbackArrivalTime;
  }

  return candidateArrivalTime;
};
