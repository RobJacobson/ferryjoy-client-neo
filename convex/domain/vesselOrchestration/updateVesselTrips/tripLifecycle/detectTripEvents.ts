/**
 * Centralized trip event detection for vessel updates.
 *
 * Produces a {@link TripEvents} bundle per ping from the prior active row (if
 * any) and the **raw** feed location. Callers use these flags before building
 * normalized `ConvexVesselTrip` rows so physical boundaries stay independent of
 * inferred trip fields.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import { resolveDebouncedPhysicalBoundaries } from "./physicalDockSeaDebounce";
import { hasTripEvidence } from "./tripDerivation";
import type { TripEvents } from "./tripEventTypes";

/**
 * Detects lifecycle flags for one ping from the prior trip and raw location.
 *
 * Uses {@link resolveDebouncedPhysicalBoundaries} plus a raw-feed schedule-key
 * comparison so trip-field inference in `buildTripCore` does not affect
 * completion detection.
 *
 * @param existingTrip - Previous trip state (`undefined` for first appearance)
 * @param currLocation - Current vessel location from REST/API (unresolved)
 * @returns {@link TripEvents} bundle for downstream builders
 */
export const detectTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): TripEvents => {
  // Resolve debounced physical boundaries from feed signals (AtDock, LeftDock, …).
  const physical = resolveDebouncedPhysicalBoundaries(
    existingTrip,
    currLocation
  );
  const continuingScheduleKey = getRawLifecycleScheduleKey(
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
    // Detect schedule-key transitions (including detachment) so stale next-leg
    // context does not linger on physical-only trips.
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

/**
 * Returns the raw-feed `ScheduleKey` used for lifecycle comparisons.
 *
 * Keep the previous dock interval on the exact leave-dock ping so a transient
 * next-leg jump in the feed does not look like a meaningful lifecycle
 * transition. This is a raw-feed debounce rule, not trip-field inference.
 *
 * @param existingTrip - Previous trip state for the vessel
 * @param currLocation - Current raw feed location
 * @returns Schedule key to compare against the stored trip row
 */
const getRawLifecycleScheduleKey = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): string | undefined => {
  const shouldPreserveDockWindowScheduleKey = Boolean(
    existingTrip?.AtDock &&
      existingTrip.LeftDock === undefined &&
      existingTrip.DepartingTerminalAbbrev ===
        currLocation.DepartingTerminalAbbrev &&
      ((currLocation.AtDock && currLocation.LeftDock === undefined) ||
        currLocation.LeftDock !== undefined)
  );

  return shouldPreserveDockWindowScheduleKey
    ? (existingTrip?.ScheduleKey ?? currLocation.ScheduleKey)
    : currLocation.ScheduleKey;
};
