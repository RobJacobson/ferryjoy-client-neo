/**
 * Event detection module for vessel trips.
 *
 * Centralizes all trip event detection logic to avoid scattering
 * detection logic across multiple files.
 */

import type { ResolvedVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripInputs, hasTripEvidence } from "./tripDerivation";

/**
 * Result of trip event detection for a vessel update.
 */
export type TripEvents = {
  isFirstTrip: boolean;
  isTripStartReady: boolean;
  shouldStartTrip: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  keyChanged: boolean;
};

export { getDockDepartureState } from "./tripDerivation";

/**
 * Detect all trip events for a vessel update.
 *
 * Centralized event detection that determines what events occurred
 * between the existing trip state and the current location.
 *
 * @param existingTrip - Previous trip state (undefined for first appearance)
 * @param currLocation - Current vessel location from REST/API
 * @returns Object with all event flags
 */
export const detectTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ResolvedVesselLocation
): TripEvents => {
  const tripInputs = deriveTripInputs(existingTrip, currLocation);
  const isTripStartReady = Boolean(
    tripInputs.currentScheduledDeparture &&
      tripInputs.currentArrivingTerminalAbbrev
  );
  // Arrival is only credible after a recorded departure and a terminal change.
  const didJustArriveAtDock = Boolean(
    existingTrip &&
      existingTrip.LeftDock !== undefined &&
      existingTrip.ArriveDest === undefined &&
      currLocation.AtDock &&
      currLocation.DepartingTerminalAbbrev !==
        existingTrip.DepartingTerminalAbbrev
  );

  return {
    isFirstTrip: !existingTrip,
    shouldStartTrip: tripInputs.didJustBecomeStartReady,
    isTripStartReady,
    isCompletedTrip: Boolean(
      hasTripEvidence(existingTrip) &&
        isTripStartReady &&
        existingTrip?.DepartingTerminalAbbrev !==
          currLocation.DepartingTerminalAbbrev
    ),
    didJustArriveAtDock,
    didJustLeaveDock: tripInputs.didJustLeaveDock,
    keyChanged: Boolean(
      tripInputs.continuingKey && existingTrip?.Key !== tripInputs.continuingKey
    ),
  };
};
