/**
 * Strips ML and joined prediction blobs from in-memory trips before persistence.
 *
 * Active and completed vessel trip tables store only the base trip row shape.
 * Prediction payloads are enrichment data used by downstream stages and should
 * not participate in storage comparison or persistence.
 */

import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";

/**
 * Returns a storage-shaped trip: same row without optional prediction fields.
 *
 * @param trip - Trip possibly carrying ML or joined prediction payloads
 * @returns Vessel trip row without prediction enrichment fields
 */
const stripVesselTripPredictions = (
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

export { stripVesselTripPredictions };
