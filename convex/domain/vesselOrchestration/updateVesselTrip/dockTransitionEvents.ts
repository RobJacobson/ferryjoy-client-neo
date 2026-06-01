/**
 * Detects dock-boundary transitions between stored and computed trip rows.
 *
 * Shared predicates are used during active-trip construction (LeftDockActual)
 * and after row finalization for event projection and ML actualization.
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
    isAtDockToAtSeaTransition(existingTrip?.AtDock, nextTrip.AtDock === true) &&
    nextTrip.LeftDockActual !== undefined,
});

/**
 * Returns whether the vessel transitioned from docked to at-sea on this ping.
 *
 * @param prevAtDock - Prior trip row AtDock, when a row existed
 * @param currAtDockObserved - Stabilized observed dock phase from the location ping
 * @returns True when the prior row was docked and the current ping is at-sea
 */
const isAtDockToAtSeaTransition = (
  prevAtDock: boolean | undefined,
  currAtDockObserved: boolean
): boolean => prevAtDock === true && currAtDockObserved === false;

export type { DockTransitionEvents };
export { getDockTransitionEvents, isAtDockToAtSeaTransition };
