/**
 * Compares vessel trip payloads for storage-level change detection.
 * This module normalizes rows by excluding non-persistent or volatile fields
 * before deciding whether a trip has materially changed.
 */
import { stripVesselTripPredictions } from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

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

  // Return false if the trips have different number of keys.
  if (
    Object.keys(currComparable).length !== Object.keys(nextComparable).length
  ) {
    return false;
  }

  // Return false if any key has a different value.
  return Object.keys(currComparable).every(
    (key) =>
      currComparable[key as keyof VesselTripComparable] ===
      nextComparable[key as keyof VesselTripComparable]
  );
};
