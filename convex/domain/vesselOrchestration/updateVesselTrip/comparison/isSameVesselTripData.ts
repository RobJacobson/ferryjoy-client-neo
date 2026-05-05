/**
 * Compares vessel trip row data for storage-level change detection.
 *
 * The trip pipeline emits dense row shapes while Convex may return sparse
 * documents with omitted optional fields. This module normalizes those shapes
 * before deciding whether any significant persisted data changed.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripVesselTripPredictions } from "./stripTripPredictionsForStorage";

type VesselTripComparable = Omit<ConvexVesselTrip, "TimeStamp">;

/**
 * Creates a deterministic comparison shape by removing TimeStamp.
 *
 * @param trip - The vessel trip row to normalize for equality checks
 * @returns A trip object suitable for storage-level field comparison
 */
const toComparableVesselTripRow = (
  trip: ConvexVesselTrip
): VesselTripComparable => {
  const { TimeStamp: _timeStamp, ...comparable } = trip;
  return comparable;
};

/**
 * Determines whether the next trip data matches the currently stored trip data.
 *
 * It strips prediction fields and compares all remaining persisted keys.
 *
 * @param currTrip - The trip currently stored, if any
 * @param nextTrip - The newly computed trip, if any
 * @returns True when all significant persisted fields are the same
 */
const isSameVesselTripData = (
  currTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip | undefined
): boolean => {
  if (currTrip === undefined || nextTrip === undefined) {
    return currTrip === nextTrip;
  }

  const currComparable = toComparableVesselTripRow(
    stripVesselTripPredictions(currTrip)
  );
  const nextComparable = toComparableVesselTripRow(
    stripVesselTripPredictions(nextTrip)
  );

  // Compare unioned keys so sparse Convex docs and dense builder rows match when values are equivalent.
  const allKeys = new Set([
    ...Object.keys(currComparable),
    ...Object.keys(nextComparable),
  ]);

  return [...allKeys].every((key) => {
    const k = key as keyof VesselTripComparable;
    return currComparable[k] === nextComparable[k];
  });
};

export { isSameVesselTripData };
