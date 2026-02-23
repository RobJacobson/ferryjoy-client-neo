/**
 * Utility functions for vessel trips - equality checking, type guards, etc.
 */

import { updatePredictionsWithActuals } from "domain/ml/prediction";
import type { ConvexPredictionRecord } from "functions/predictions/schemas";
import {
  extractPredictionRecord,
  PREDICTION_FIELDS,
} from "functions/predictions/utils";
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
 * Compares all fields in both directions, excluding only TimeStamp (which changes
 * every tick and is not semantically significant). This ensures that any new
 * fields added to the schema are automatically included in equality checks.
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

// ============================================================================
// Prediction Utilities
// ============================================================================

/**
 * Update predictions with actuals and extract completed records.
 *
 * Consolidates the pattern of calling updatePredictionsWithActuals
 * and extracting prediction records that's used in multiple places.
 *
 * @param existingTrip - Trip before updates
 * @param finalTrip - Trip after all updates applied
 * @returns Updated trip with actuals and completed prediction records
 */
export const updateAndExtractPredictions = (
  existingTrip: ConvexVesselTrip,
  finalTrip: ConvexVesselTrip
): {
  updatedTrip: ConvexVesselTrip;
  completedRecords: ConvexPredictionRecord[];
} => {
  const updates = updatePredictionsWithActuals(existingTrip, finalTrip);
  const updated = { ...finalTrip, ...updates };
  const records = PREDICTION_FIELDS.map((field) =>
    extractPredictionRecord(updated, field)
  ).filter((r): r is ConvexPredictionRecord => r !== null);
  return { updatedTrip: updated, completedRecords: records };
};
