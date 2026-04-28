/**
 * Strip ML / joined prediction blobs from in-memory trips before Convex persistence.
 * `activeVesselTrips` / `completedVesselTrips` store {@link ConvexVesselTrip} only.
 */

import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";

/**
 * Returns a storage-shaped trip: same row without optional prediction fields.
 *
 * @param trip - Trip possibly carrying ML or joined prediction payloads
 */
export const stripVesselTripPredictions = (
  trip: ConvexVesselTripWithML
): ConvexVesselTrip => {
  const {
    AtDockDepartCurr: _stripAtDockDepartCurr,
    AtDockArriveNext: _stripAtDockArriveNext,
    AtDockDepartNext: _stripAtDockDepartNext,
    AtSeaArriveNext: _stripAtSeaArriveNext,
    AtSeaDepartNext: _stripAtSeaDepartNext,
    ...stored
  } = trip;
  return stored;
};
