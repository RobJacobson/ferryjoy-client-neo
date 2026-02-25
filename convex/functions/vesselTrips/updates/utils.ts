/**
 * Utility functions for vessel trips - equality checking, type guards, etc.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

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
): boolean =>
  compareTripFields(existing, existing, proposed) &&
  compareTripFields(proposed, existing, proposed);

/**
 * Compare trip fields between existing and proposed trips, excluding TimeStamp.
 *
 * Iterates through all keys in the source trip and compares values between
 * existing and proposed trips. Skips TimeStamp field which changes every tick.
 *
 * @param source - Trip whose keys to iterate over
 * @param existing - Existing trip from database
 * @param proposed - Newly constructed trip
 * @returns true if all non-TimeStamp fields match
 */
const compareTripFields = (
  source: ConvexVesselTrip,
  existing: ConvexVesselTrip,
  proposed: ConvexVesselTrip
): boolean => {
  for (const key in source) {
    if (key === "TimeStamp") continue;
    if (
      !deepEqual(
        existing[key as keyof ConvexVesselTrip],
        proposed[key as keyof ConvexVesselTrip]
      )
    ) {
      return false;
    }
  }
  return true;
};

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
