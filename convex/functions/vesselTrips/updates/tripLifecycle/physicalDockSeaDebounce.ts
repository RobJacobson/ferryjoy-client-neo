/**
 * Physical dock vs sea debouncing for one orchestrator tick.
 *
 * Uses only feed signals `AtDock`, `LeftDock`, and `Speed` (with `> 1` as
 * underway). Combines the persisted trip row with the current tick to tolerate
 * a single contradictory sample without flipping lifecycle ownership.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Returns the persisted departure timestamp for lifecycle, preferring
 * {@link ConvexVesselTrip.DepartOriginActual} over legacy departure mirrors.
 *
 * @param trip - Active trip row, if any
 * @returns Epoch ms when the vessel has physically departed, else undefined
 */
export const getPhysicalDepartureStamp = (
  trip: ConvexVesselTrip | undefined
): number | undefined =>
  trip?.DepartOriginActual ?? trip?.LeftDockActual ?? trip?.LeftDock;

/**
 * Raw tick suggests the vessel is still in a dock interval (low speed, docked).
 *
 * @param location - Current vessel location sample
 * @returns True when AtDock reads docked and speed is not clearly underway
 */
export const rawTickSuggestsDocked = (
  location: ConvexVesselLocation
): boolean => location.AtDock && !(location.Speed > 1);

/**
 * True when the feed reports a new departure time this tick but the physical
 * hints still look docked — suppress `didJustLeaveDock` for this tick.
 *
 * @param existingTrip - Previous active trip
 * @param currLocation - Current vessel location
 * @returns True when departure should not commit yet
 */
export const rawDepartureIsContradictory = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean =>
  Boolean(
    existingTrip &&
      getPhysicalDepartureStamp(existingTrip) === undefined &&
      currLocation.LeftDock !== undefined &&
      rawTickSuggestsDocked(currLocation)
  );

/**
 * True when arrival would fire but speed contradicts being moored.
 *
 * @param currLocation - Current vessel location
 * @returns True when arrival should not commit yet
 */
export const rawArrivalIsContradictory = (
  currLocation: ConvexVesselLocation
): boolean => Boolean(currLocation.AtDock && currLocation.Speed > 1);

/**
 * Raw departure: first time `LeftDock` appears on the feed for this trip.
 *
 * @param existingTrip - Previous active trip
 * @param currLocation - Current vessel location
 * @returns True when the feed introduces a departure timestamp
 */
export const rawDidJustLeaveDock = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean =>
  Boolean(
    existingTrip &&
      getPhysicalDepartureStamp(existingTrip) === undefined &&
      currLocation.LeftDock !== undefined
  );

/**
 * Raw arrival: underway trip, at dock, new departing terminal (vessel moved).
 *
 * @param existingTrip - Previous active trip
 * @param currLocation - Current vessel location
 * @returns True when a completion boundary is credibly observed
 */
export const rawDidJustArriveAtDock = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean => {
  if (!existingTrip) {
    return false;
  }

  const departed = getPhysicalDepartureStamp(existingTrip);
  if (
    departed === undefined ||
    existingTrip.ArriveDestDockActual !== undefined ||
    existingTrip.ArriveDest !== undefined
  ) {
    return false;
  }

  if (!currLocation.AtDock) {
    return false;
  }

  if (
    currLocation.DepartingTerminalAbbrev ===
    existingTrip.DepartingTerminalAbbrev
  ) {
    return false;
  }

  return true;
};

export type DebouncedPhysicalBoundaryResult = {
  didJustLeaveDock: boolean;
  didJustArriveAtDock: boolean;
};

/**
 * Applies single-tick debounce and enforces at most one lifecycle transition.
 *
 * When both departure and arrival would fire, the tick is ambiguous: neither
 * fires so ownership does not churn twice.
 *
 * @param existingTrip - Previous active trip, if any
 * @param currLocation - Current vessel location
 * @returns Debounced boundary flags for this tick
 */
export const resolveDebouncedPhysicalBoundaries = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): DebouncedPhysicalBoundaryResult => {
  let didJustLeaveDock =
    rawDidJustLeaveDock(existingTrip, currLocation) &&
    !rawDepartureIsContradictory(existingTrip, currLocation);

  let didJustArriveAtDock =
    rawDidJustArriveAtDock(existingTrip, currLocation) &&
    !rawArrivalIsContradictory(currLocation);

  if (didJustLeaveDock && didJustArriveAtDock) {
    didJustLeaveDock = false;
    didJustArriveAtDock = false;
  }

  return { didJustLeaveDock, didJustArriveAtDock };
};
