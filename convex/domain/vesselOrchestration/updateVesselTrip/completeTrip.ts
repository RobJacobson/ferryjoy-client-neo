/**
 * Completed-trip row shaping for terminal-transition closeout.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";

/**
 * Builds the archived trip row when a terminal transition closes a leg.
 *
 * @param previousTrip - Existing active trip row being completed
 * @param location - Incoming vessel location ping that triggered completion
 * @returns Completed trip row with end/duration facts finalized
 */
export const completeTrip = (
  previousTrip: ConvexVesselTrip,
  location: ConvexVesselLocation
): ConvexVesselTrip => {
  const completionTime = location.TimeStamp;
  const departureForDurations =
    previousTrip.LeftDockActual ?? previousTrip.LeftDock;
  const tripStartForDurations = previousTrip.TripStart;

  return {
    ...previousTrip,
    ArrivingTerminalAbbrev:
      previousTrip.ArrivingTerminalAbbrev ?? location.DepartingTerminalAbbrev,
    TripEnd: completionTime,
    AtSeaDuration: calculateTimeDelta(departureForDurations, completionTime),
    TotalDuration: calculateTimeDelta(tripStartForDurations, completionTime),
    TripStart: previousTrip.TripStart,
    LeftDockActual: previousTrip.LeftDockActual ?? previousTrip.LeftDock,
  };
};
