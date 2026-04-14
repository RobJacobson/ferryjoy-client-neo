/**
 * Centralized trip event detection for vessel updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { resolveDebouncedPhysicalBoundaries } from "./physicalDockSeaDebounce";
import { deriveTripInputs, hasTripEvidence } from "./tripDerivation";
import type { TripEvents } from "./tripEventTypes";

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
  currLocation: ConvexVesselLocation
): TripEvents => {
  const tripInputs = deriveTripInputs(existingTrip, currLocation);
  const isTripStartReady = tripInputs.currentIsTripStartReady;
  const { didJustLeaveDock, didJustArriveAtDock } =
    resolveDebouncedPhysicalBoundaries(existingTrip, currLocation);

  return {
    isFirstTrip: !existingTrip,
    shouldStartTrip: false,
    isTripStartReady,
    isCompletedTrip: Boolean(
      hasTripEvidence(existingTrip) && didJustArriveAtDock
    ),
    didJustArriveAtDock,
    didJustLeaveDock,
    scheduleKeyChanged: Boolean(
      tripInputs.continuingScheduleKey &&
        existingTrip?.ScheduleKey !== tripInputs.continuingScheduleKey
    ),
  };
};
