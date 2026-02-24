/**
 * Utility functions for vessel trips - equality checking, type guards, etc.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

// ============================================================================
// Deep Equality Utilities
// ============================================================================

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
 * Deep equality for ConvexVesselTrip objects, excluding TimeStamp.
 *
 * Compares all fields in both directions to detect added/removed fields.
 * Excludes TimeStamp (which changes every tick and is not semantically
 * significant). Deep equality handles nested objects and arrays.
 *
 * Bidirectional comparison ensures new fields in proposed are detected.
 *
 * @param existing - Existing trip from database
 * @param proposed - Newly constructed trip
 * @returns true if all non-TimeStamp fields are deeply equal
 */
export const tripsAreEqual = (
  existing: ConvexVesselTrip,
  proposed: ConvexVesselTrip
): boolean => {
  const excludeFields = new Set<keyof ConvexVesselTrip>(["TimeStamp"]);

  const compareFields = (source: ConvexVesselTrip): boolean => {
    for (const key in source) {
      if (!excludeFields.has(key as keyof ConvexVesselTrip)) {
        if (
          !deepEqual(
            existing[key as keyof ConvexVesselTrip],
            proposed[key as keyof ConvexVesselTrip]
          )
        ) {
          return false;
        }
      }
    }
    return true;
  };

  // Compare all fields from existing and proposed (except excluded)
  return compareFields(existing) && compareFields(proposed);
};
