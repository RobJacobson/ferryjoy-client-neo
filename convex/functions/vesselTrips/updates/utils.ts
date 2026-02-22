/**
 * Utility functions for vessel trips - equality checking, type guards, etc.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

// ============================================================================
// Deep Equality Utilities
// ============================================================================

const FIELDS_TO_COMPARE: Array<keyof ConvexVesselTrip> = [
  "VesselAbbrev",
  "DepartingTerminalAbbrev",
  "ArrivingTerminalAbbrev",
  "RouteID",
  "RouteAbbrev",
  "Key",
  "SailingDay",
  "PrevTerminalAbbrev",
  "TripStart",
  "AtDock",
  "AtDockDuration",
  "ScheduledDeparture",
  "LeftDock",
  "TripDelay",
  "Eta",
  "TripEnd",
  "AtSeaDuration",
  "TotalDuration",
  "InService",
  "PrevScheduledDeparture",
  "PrevLeftDock",
  "AtDockDepartCurr",
  "AtDockArriveNext",
  "AtDockDepartNext",
  "AtSeaArriveNext",
  "AtSeaDepartNext",
  "ScheduledTrip",
];

/**
 * Deep equality check for arbitrary values.
 *
 * Handles primitives, arrays, objects, undefined, and null. undefined === undefined
 * returns true. undefined vs null returns false.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;

  if (a == null || b == null) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
};

/**
 * Optimized deep equality for ConvexVesselTrip objects.
 *
 * Skips TimeStamp (changes every tick) and read-only Convex fields (_id,
 * _creationTime). Compares all semantic fields per Field Reference 2.6.
 *
 * @param existing - Existing trip from database
 * @param proposed - Newly constructed trip
 * @returns true if semantic fields are deeply equal
 */
export const tripsAreEqual = (
  existing: ConvexVesselTrip,
  proposed: ConvexVesselTrip
): boolean => {
  for (const field of FIELDS_TO_COMPARE) {
    if (!deepEqual(existing[field], proposed[field])) {
      return false;
    }
  }

  return true;
};
