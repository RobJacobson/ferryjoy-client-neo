/**
 * Joins one realtime feed row to its prior active trip (if any) and runs
 * {@link detectTripEvents} on the raw sample.
 */

import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";
import type { CalculatedTripUpdate } from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Joins one feed row to its prior active and computes lifecycle flags for this
 * ping. Does not build stored trip rows.
 *
 * @param vesselLocation - Current row for one vessel
 * @param activesByVessel - Prior actives keyed by `VesselAbbrev` (later
 *   duplicates win); built in {@link computeVesselTripsRows}
 * @returns {@link CalculatedTripUpdate} for {@link tripRowsForVesselPing}
 */
export const calculateTripUpdateForVessel = (
  vesselLocation: ConvexVesselLocation,
  activesByVessel: Partial<Record<string, ConvexVesselTrip>>
): CalculatedTripUpdate => {
  const existingActiveTrip = activesByVessel[vesselLocation.VesselAbbrev];

  return {
    vesselLocation,
    existingActiveTrip,
    events: detectTripEvents(existingActiveTrip, vesselLocation),
  };
};
