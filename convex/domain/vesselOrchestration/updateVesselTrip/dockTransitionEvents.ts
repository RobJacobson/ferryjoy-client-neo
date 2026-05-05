/**
 * Detects dock-boundary transitions between stored and computed trip rows.
 *
 * Downstream event projection uses these booleans to decide whether a trip
 * update should write actual departure or arrival boundary events. This module
 * does not drive trip lifecycle; it only reports transition facts after row
 * construction.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

type DockTransitionEvents = {
  didJustLeaveDock: boolean;
  didJustArriveAtDock: boolean;
};

/**
 * Dock boundary transitions on the active trip branch for this ping.
 *
 * @param existingTrip - Existing active trip before update, if any
 * @param nextTrip - Candidate active trip row for persistence
 * @returns Dock transition booleans for downstream event projection
 */
const getDockTransitionEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): DockTransitionEvents => ({
  didJustArriveAtDock:
    existingTrip?.AtDock !== true &&
    nextTrip.AtDock === true &&
    nextTrip.TripEnd !== undefined,
  didJustLeaveDock:
    existingTrip?.AtDock === true &&
    nextTrip.AtDock !== true &&
    nextTrip.LeftDockActual !== undefined,
});

export type { DockTransitionEvents };
export { getDockTransitionEvents };
