/**
 * Focused lifecycle signal helpers for active-trip updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Returns whether the incoming ping starts a new trip leg.
 *
 * @param previousTrip - Existing active trip row, if present
 * @param location - Incoming vessel location ping
 * @returns True when the departing terminal changed from prior active trip
 */
export const isNewTrip = (
  previousTrip: ConvexVesselTrip | undefined,
  location: ConvexVesselLocation
): boolean =>
  previousTrip !== undefined &&
  previousTrip.DepartingTerminalAbbrev !== location.DepartingTerminalAbbrev;

/**
 * Returns whether the vessel just transitioned from docked to at-sea.
 *
 * @param previousTrip - Existing active trip row, if present
 * @param location - Incoming vessel location ping
 * @returns True when prior row was docked and current ping is not docked
 */
export const didLeaveDock = (
  previousTrip: ConvexVesselTrip | undefined,
  location: ConvexVesselLocation
): boolean =>
  previousTrip?.AtDock === true && location.AtDockObserved === false;

/**
 * Resolves the best departure timestamp for the active-trip update.
 *
 * Precedence:
 * 1) persisted departure (`LeftDockActual ?? LeftDock`)
 * 2) feed departure (`location.LeftDock`)
 * 3) transition timestamp (`location.TimeStamp`) only when just left dock
 *
 * @param previousTrip - Existing active trip row, if present
 * @param location - Incoming vessel location ping
 * @returns Departure timestamp for update fields, or `undefined`
 */
export const leftDockTimeForUpdate = (
  previousTrip: ConvexVesselTrip | undefined,
  location: ConvexVesselLocation
): number | undefined => {
  const persistedDeparture =
    previousTrip?.LeftDockActual ?? previousTrip?.LeftDock;
  if (persistedDeparture !== undefined) {
    return persistedDeparture;
  }

  if (location.LeftDock !== undefined) {
    return location.LeftDock;
  }

  return didLeaveDock(previousTrip, location) ? location.TimeStamp : undefined;
};
