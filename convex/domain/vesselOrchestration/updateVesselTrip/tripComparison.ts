/**
 * Compares vessel trip payloads for storage-level change detection.
 * This module normalizes rows by excluding non-persistent or volatile fields
 * before deciding whether a trip has materially changed.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripVesselTripPredictions } from "./stripTripPredictionsForStorage";

type VesselTripComparable = Omit<ConvexVesselTrip, "TimeStamp">;

/**
 * Creates a deterministic comparison shape by removing `TimeStamp`.
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
 * Determines whether the next trip differs from the currently stored trip.
 * It strips prediction fields and compares all remaining persisted keys.
 *
 * @param currTrip - The trip currently stored, if any
 * @param nextTrip - The newly computed trip, if any
 * @returns `true` when all persisted fields are the same
 */
export const isSameVesselTrip = (
  currTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip | undefined
): boolean => {
  // Return true if both trips are undefined.
  if (currTrip === undefined || nextTrip === undefined) {
    return currTrip === nextTrip;
  }

  // Normalize the trips for comparison.
  const currComparable = toComparableVesselTripRow(
    stripVesselTripPredictions(currTrip)
  );
  const nextComparable = toComparableVesselTripRow(
    stripVesselTripPredictions(nextTrip)
  );

  // Convex documents omit unset optional fields; trip builders often attach the
  // full schema shape with explicit `undefined`. Compare the union of keys and
  // treat missing properties as `undefined` so sparse vs dense rows match.
  const allKeys = new Set([
    ...Object.keys(currComparable),
    ...Object.keys(nextComparable),
  ]);

  return [...allKeys].every((key) => {
    const k = key as keyof VesselTripComparable;
    return currComparable[k] === nextComparable[k];
  });
};
