/**
 * Pure functions for extracting terminal labels from vessel location data.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";

/**
 * Returns the terminal name for the origin (departing) terminal.
 *
 * @param vesselLocation - Real-time vessel location
 * @returns Departing terminal name
 */
export const getTerminalNameAtOrigin = (
  vesselLocation: VesselLocation
): string => vesselLocation.DepartingTerminalName;

/**
 * Returns the terminal name for the destination (arriving) terminal.
 *
 * @param vesselLocation - Real-time vessel location
 * @returns Arriving terminal name, or undefined if not yet known
 */
export const getTerminalNameAtDestination = (
  vesselLocation: VesselLocation
): string | undefined => vesselLocation.ArrivingTerminalName;
