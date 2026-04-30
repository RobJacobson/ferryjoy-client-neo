/**
 * Focused lifecycle signal helpers for active-trip updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Returns whether the incoming ping starts a new trip leg.
 *
 * @param prev - Stored active trip row for this vessel, if present
 * @param curr - Current vessel location ping
 * @returns True when the departing terminal changed from the stored row
 */
export const isNewTrip = (
  prev: ConvexVesselTrip | undefined,
  curr: ConvexVesselLocation
): boolean =>
  prev !== undefined &&
  prev.DepartingTerminalAbbrev !== curr.DepartingTerminalAbbrev;

/**
 * Returns whether the vessel just transitioned from docked to at-sea.
 *
 * @param prev - Stored active trip row for this vessel, if present
 * @param curr - Current vessel location ping
 * @returns True when prior row was docked and current ping is not docked
 */
export const didLeaveDock = (
  prev: ConvexVesselTrip | undefined,
  curr: ConvexVesselLocation
): boolean => prev?.AtDock === true && curr.AtDockObserved === false;

/**
 * Resolves the best departure timestamp for the active-trip update.
 *
 * Precedence:
 * 1) persisted departure (`LeftDockActual ?? LeftDock`)
 * 2) feed departure (`curr.LeftDock`)
 * 3) transition timestamp (`curr.TimeStamp`) only when just left dock
 *
 * @param prev - Stored active trip row for this vessel, if present
 * @param curr - Current vessel location ping
 * @returns Departure timestamp for update fields, or `undefined`
 */
export const leftDockTimeForUpdate = (
  prev: ConvexVesselTrip | undefined,
  curr: ConvexVesselLocation
): number | undefined => {
  const persistedDeparture = prev?.LeftDockActual ?? prev?.LeftDock;
  if (persistedDeparture !== undefined) {
    return persistedDeparture;
  }

  if (curr.LeftDock !== undefined) {
    return curr.LeftDock;
  }

  return didLeaveDock(prev, curr) ? curr.TimeStamp : undefined;
};
