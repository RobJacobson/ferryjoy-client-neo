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

  return (
    JSON.stringify(
      toComparableTripStorageRow(stripTripPredictionsForStorage(existingTrip))
    ) ===
    JSON.stringify(
      toComparableTripStorageRow(stripTripPredictionsForStorage(nextTrip))
    )
  );
};
