import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripTripPredictionsForStorage } from "./orchestratorPersist";

export const areTripStorageRowsEqual = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip | undefined
): boolean => {
  if (existingTrip === undefined || nextTrip === undefined) {
    return existingTrip === nextTrip;
  }

  return (
    JSON.stringify(stripTripPredictionsForStorage(existingTrip)) ===
    JSON.stringify(stripTripPredictionsForStorage(nextTrip))
  );
};
