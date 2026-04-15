import { actualizePredictionsOnTripComplete } from "domain/ml/prediction";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";

/**
 * Build completed trip with canonical end-time, arrival, and duration fields.
 *
 * Completion is the last safe chance to write the canonical destination
 * arrival when the lifecycle path has a trusted arrival fact. When the caller
 * indicates the close is synthetic, the row still closes at `currLocation.TimeStamp`
 * but `ArrivedNextActual` stays undefined.
 *
 * @param existingTrip - Trip being completed
 * @param currLocation - Current location with TripEnd timestamp
 * @param hasTrustedArrival - Whether this completion represents a real arrival
 * @returns Completed trip with all completion fields set
 */
export const buildCompletedTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation,
  hasTrustedArrival: boolean
): ConvexVesselTripWithML => {
  const completionTime = currLocation.TimeStamp;
  const trustedArrivalTime = hasTrustedArrival ? completionTime : undefined;
  const withTripEnd = {
    ...existingTrip,
    ArrivingTerminalAbbrev:
      existingTrip.ArrivingTerminalAbbrev ??
      currLocation.DepartingTerminalAbbrev,
    ArrivedCurrActual: existingTrip.ArrivedCurrActual,
    ArrivedNextActual: trustedArrivalTime,
    LeftDockActual: existingTrip.LeftDockActual,
    StartTime: existingTrip.StartTime,
    EndTime: completionTime,
    ArriveDest: trustedArrivalTime,
    TripEnd: completionTime,
  };
  const departureForDurations =
    withTripEnd.LeftDockActual ?? withTripEnd.LeftDock;
  const tripStartForDurations = withTripEnd.StartTime ?? withTripEnd.TripStart;
  const arrivalForDurations = trustedArrivalTime ?? completionTime;

  const withDurations = {
    ...withTripEnd,
    AtSeaDuration: calculateTimeDelta(
      departureForDurations,
      arrivalForDurations
    ),
    TotalDuration: calculateTimeDelta(tripStartForDurations, completionTime),
    // Keep compatibility mirrors aligned with the canonical fields.
    AtDockActual: withTripEnd.ArrivedCurrActual ?? withTripEnd.AtDockActual,
    LeftDockActual: withTripEnd.LeftDockActual ?? withTripEnd.LeftDock,
  };

  return actualizePredictionsOnTripComplete(withDurations);
};
