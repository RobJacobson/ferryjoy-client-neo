import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type CurrentTripDockEvents = {
  didJustLeaveDock: boolean;
  didJustArriveAtDock: boolean;
};

/**
 * Dock boundary transitions on the active trip branch for this ping.
 *
 * @param existingTrip - Existing active trip before update, if any
 * @param nextTrip - Candidate active trip row for persistence
 */
export const currentTripDockEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): CurrentTripDockEvents => ({
  didJustArriveAtDock:
    existingTrip?.AtDock !== true &&
    nextTrip.AtDock === true &&
    nextTrip.TripEnd !== undefined,
  didJustLeaveDock:
    existingTrip?.AtDock === true &&
    nextTrip.AtDock !== true &&
    nextTrip.LeftDockActual !== undefined,
});
