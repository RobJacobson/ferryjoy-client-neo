/**
 * Centralized trip event detection for vessel updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripInputs, hasTripEvidence } from "./tripDerivation";
import type { TripEvents } from "./tripEventTypes";

/**
 * Detects lifecycle flags for one ping from the prior trip and raw location.
 *
 * Uses {@link deriveTripInputs} with the **raw** feed row so schedule
 * resolution in `buildTripCore` does not affect completion detection.
 *
 * @param existingTrip - Previous trip state (`undefined` for first appearance)
 * @param currLocation - Current vessel location from REST/API (unresolved)
 * @returns {@link TripEvents} bundle for downstream builders
 */
export const detectTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): TripEvents => {
  const tripInputs = deriveTripInputs(existingTrip, currLocation);
  const isTripStartReady = tripInputs.currentIsTripStartReady;
  const { didJustLeaveDock, didJustArriveAtDock } = tripInputs;

  return {
    isFirstTrip: !existingTrip,
    shouldStartTrip: false,
    isTripStartReady,
    isCompletedTrip: Boolean(
      hasTripEvidence(existingTrip) && didJustArriveAtDock
    ),
    didJustArriveAtDock,
    didJustLeaveDock,
    // Treat detachment from schedule identity (`some-key -> undefined`) as a
    // real transition. Otherwise stale next-leg context can linger on a trip
    // that should now be physical-only.
    scheduleKeyChanged:
      existingTrip?.ScheduleKey !== tripInputs.continuingScheduleKey,
  };
};
