import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

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

export const logTripPipelineFailure = (
  vesselAbbrev: string,
  phase: string,
  error: unknown
): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    `[VesselTrips] Failed ${phase} for ${vesselAbbrev}: ${err.message}`,
    err
  );
};

