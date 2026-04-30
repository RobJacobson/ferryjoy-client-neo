/**
 * Completed-trip row shaping for terminal-transition closeout.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";

/**
 * Builds the archived trip row when a terminal transition closes a leg.
 *
 * @param prev - Existing active trip row being completed
 * @param curr - Incoming vessel location ping that triggered completion
 * @returns Completed trip row with end/duration facts finalized
 */
export const buildCompleteTrip = (
  prev: ConvexVesselTrip,
  curr: ConvexVesselLocation
): ConvexVesselTrip => ({
  ...prev,
  ArrivingTerminalAbbrev:
    prev.ArrivingTerminalAbbrev ?? curr.DepartingTerminalAbbrev,
  TripEnd: curr.TimeStamp,
  AtSeaDuration: calculateTimeDelta(
    prev.LeftDockActual ?? prev.LeftDock,
    curr.TimeStamp
  ),
  TotalDuration: calculateTimeDelta(prev.TripStart, curr.TimeStamp),
  LeftDockActual: prev.LeftDockActual ?? prev.LeftDock,
});
