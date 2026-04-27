import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripTripPredictionsForStorage } from "./orchestratorPersist";

type TripStorageComparable = Omit<ConvexVesselTrip, "TimeStamp">;

const toComparableTripStorageRow = (
  trip: ConvexVesselTrip
): TripStorageComparable => {
  const { TimeStamp: _timeStamp, ...comparable } = trip;
  return comparable;
};

export const areTripStorageRowsEqual = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip | undefined
): boolean => {
  if (existingTrip === undefined || nextTrip === undefined) {
    return existingTrip === nextTrip;
  }

  const existingComparable = toComparableTripStorageRow(
    stripTripPredictionsForStorage(existingTrip)
  );
  const nextComparable = toComparableTripStorageRow(
    stripTripPredictionsForStorage(nextTrip)
  );
  const keys = new Set([
    ...Object.keys(existingComparable),
    ...Object.keys(nextComparable),
  ]);

  for (const key of keys) {
    const existingValue =
      existingComparable[key as keyof TripStorageComparable];
    const nextValue = nextComparable[key as keyof TripStorageComparable];
    if (existingValue !== nextValue) {
      return false;
    }
  }

  return true;
};
