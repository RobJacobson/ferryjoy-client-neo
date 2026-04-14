import { actualizePredictionsOnTripComplete } from "domain/ml/prediction";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";

/**
 * Build completed trip with TripEnd, AtSeaDuration, and TotalDuration.
 *
 * Adds TripEnd, AtSeaDuration, TotalDuration, and same-trip prediction actuals
 * to the final completed trip. Completion is also the last safe chance to
 * backfill the physical arrival terminal from the current docked location
 * when the trip never had a trustworthy scheduled destination. That backfill
 * keeps downstream `arv-dock` actual projection from silently dropping a real
 * arrival event.
 *
 * @param existingTrip - Trip being completed
 * @param currLocation - Current location with TripEnd timestamp
 * @returns Completed trip with all completion fields set
 */
export const buildCompletedTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): ConvexVesselTripWithML => {
  const effectiveArrivalTime = getEffectiveArrivalTime(
    existingTrip,
    currLocation.TimeStamp
  );
  const withTripEnd = {
    ...existingTrip,
    // Preserve the trusted destination when we have one, but fall back to the
    // dock the vessel is physically occupying on completion so unknown-
    // destination arrivals still persist an `arv-dock` actual.
    ArrivingTerminalAbbrev:
      existingTrip.ArrivingTerminalAbbrev ??
      currLocation.DepartingTerminalAbbrev,
    ArriveDest: effectiveArrivalTime,
    TripEnd: currLocation.TimeStamp,
  };
  const departureForDurations =
    withTripEnd.LeftDockActual ?? withTripEnd.LeftDock;

  const withDurations = {
    ...withTripEnd,
    AtSeaDuration: calculateTimeDelta(
      departureForDurations,
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

  const departureMs = existingTrip.LeftDockActual ?? existingTrip.LeftDock;

  if (
    (departureMs !== undefined && candidateArrivalTime < departureMs) ||
    (existingTrip.TripStart !== undefined &&
      candidateArrivalTime < existingTrip.TripStart)
  ) {
    // Guard against stale feed values that would make the trip go backward.
    return fallbackArrivalTime;
  }

  return candidateArrivalTime;
};
