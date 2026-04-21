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
 * @param activesByVessel - Output of {@link activeTripsByVesselAbbrev}
 * @returns {@link CalculatedTripUpdate} for {@link tripRowsForVesselPing}
 */
export const calculatedTripUpdateForFeedRow = (
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

/**
 * Builds a vessel-abbrev lookup for prior active trips (later duplicates win by
 * `VesselAbbrev`, matching plain object merge semantics).
 *
 * @param existingActiveTrips - Prior active trips for the batch
 * @returns Partial map from vessel abbrev to trip (missing key means no prior
 *   active for that vessel)
 */
export const activeTripsByVesselAbbrev = (
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): Partial<Record<string, ConvexVesselTrip>> =>
  Object.fromEntries(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
