import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Compares the persisted shape of two trip rows so downstream stages can reason
 * about whether the active-trip storage row would actually change.
 */
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
