/**
 * Centralized trip event detection for vessel updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import { resolveDebouncedPhysicalBoundaries } from "./physicalDockSeaDebounce";
import { deriveContinuingScheduleKey, hasTripEvidence } from "./tripDerivation";
import type { TripEvents } from "./tripEventTypes";

/**
 * Detects lifecycle flags for one ping from the prior trip and raw location.
 *
 * Uses {@link resolveDebouncedPhysicalBoundaries} and
 * {@link deriveContinuingScheduleKey} with the **raw** feed row so schedule
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
  const physical = resolveDebouncedPhysicalBoundaries(
    existingTrip,
    currLocation
  );
  const continuingScheduleKey = deriveContinuingScheduleKey(
    existingTrip,
    currLocation
  );

  return {
    isFirstTrip: computeIsFirstTrip(existingTrip),
    isTripStartReady: computeIsTripStartReady(currLocation),
    isCompletedTrip: computeIsCompletedTrip(
      existingTrip,
      physical.didJustArriveAtDock
    ),
    didJustArriveAtDock: physical.didJustArriveAtDock,
    didJustLeaveDock: physical.didJustLeaveDock,
    // Treat detachment from schedule identity (`some-key -> undefined`) as a
    // real transition. Otherwise stale next-leg context can linger on a trip
    // that should now be physical-only.
    scheduleKeyChanged: computeScheduleKeyChanged(
      existingTrip,
      continuingScheduleKey
    ),
  };
};

/**
 * True when there is no prior active trip row for this vessel.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @returns Whether this ping is the first tracked trip for the vessel
 */
const computeIsFirstTrip = (
  existingTrip: ConvexVesselTrip | undefined
): boolean => existingTrip === undefined;

/**
 * Whether the current feed row has enough schedule fields to start a trip.
 *
 * @param currLocation - Current vessel location from the live feed
 * @returns True when arriving terminal and scheduled departure are present
 */
const computeIsTripStartReady = (currLocation: ConvexVesselLocation): boolean =>
  deriveTripIdentity({
    vesselAbbrev: currLocation.VesselAbbrev,
    departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
    scheduledDepartureMs: currLocation.ScheduledDeparture,
  }).isTripStartReady;

/**
 * True when the prior trip should close because arrival at the next dock fired.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param didJustArriveAtDock - Debounced arrival boundary for this ping
 * @returns Whether completion handling should run for this vessel
 */
const computeIsCompletedTrip = (
  existingTrip: ConvexVesselTrip | undefined,
  didJustArriveAtDock: boolean
): boolean => Boolean(hasTripEvidence(existingTrip) && didJustArriveAtDock);

/**
 * True when the continuing schedule segment key differs from the stored row.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param continuingScheduleKey - Segment key after dock carry-forward rules
 * @returns Whether schedule-derived state may need to reset for this ping
 */
const computeScheduleKeyChanged = (
  existingTrip: ConvexVesselTrip | undefined,
  continuingScheduleKey: string | undefined
): boolean => existingTrip?.ScheduleKey !== continuingScheduleKey;
