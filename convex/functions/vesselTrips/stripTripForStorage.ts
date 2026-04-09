/**
 * Removes in-memory ML prediction blobs before persisting vessel trip rows.
 */

import type { ConvexVesselTripStored, ConvexVesselTripWithML } from "./schemas";

/**
 * Strips the five ML prediction fields so only `vesselTripStoredSchema` fields
 * are written to `activeVesselTrips` / `completedVesselTrips`.
 *
 * @param trip - Trip possibly carrying full `ConvexPrediction` blobs
 * @returns Stored trip document fields only
 */
export const stripTripPredictionsForStorage = (
  trip: ConvexVesselTripWithML
): ConvexVesselTripStored => {
  // Ignore the five ML prediction fields, return the rest
  const {
    AtDockDepartCurr: _adc,
    AtDockArriveNext: _aan,
    AtDockDepartNext: _adn,
    AtSeaArriveNext: _san,
    AtSeaDepartNext: _sdn,
    ...rest
  } = trip;
  return rest;
};
