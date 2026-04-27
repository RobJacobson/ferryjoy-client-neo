/**
 * Batch trip row computation across vessel location rows.
 */
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./types";
import { updateVesselTrips } from "./updateVesselTrips";

/**
 * Computes persisted trip rows for one ping input.
 *
 * @param input - Input containing locations, active trips, and schedule data
 * @returns Active and completed trip rows ready for persistence
 */
export const computeVesselTripsRows = async (
  input: RunUpdateVesselTripsInput
): Promise<RunUpdateVesselTripsOutput> => {
  const existingActiveTripsByVessel = activeTripsByVesselAbbrev(
    input.existingActiveTrips
  );
  const updates = await Promise.all(
    input.vesselLocations.map((vesselLocation) =>
      updateVesselTrips({
        vesselLocation,
        existingActiveTrip: existingActiveTripsByVessel.get(
          vesselLocation.VesselAbbrev
        ),
        scheduleAccess: input.scheduleAccess,
      })
    )
  );
  const activeTripCandidates = updates
    .map((update) => update.activeVesselTripUpdate)
    .filter((trip): trip is ConvexVesselTrip => trip !== undefined);
  const completedTrips = updates
    .map((update) => update.completedVesselTripUpdate)
    .filter((trip): trip is ConvexVesselTrip => trip !== undefined);

  return {
    completedTrips,
    activeTrips: mergeActiveTripRows(
      input.existingActiveTrips,
      activeTripCandidates
    ),
  };
};

/**
 * Indexes active trips by vessel abbreviation for O(1) lookup.
 *
 * @param existingActiveTrips - Active trip rows from storage
 * @returns Map keyed by vessel abbreviation
 */
const activeTripsByVesselAbbrev = (
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): Map<string, ConvexVesselTrip> =>
  new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

/**
 * Merges processed active rows into existing rows by vessel key.
 *
 * @param existingActiveTrips - Existing active rows from storage
 * @param processedActiveTrips - Newly computed active rows for processed vessels
 * @returns Active rows with processed vessels replaced and others preserved
 */
const mergeActiveTripRows = (
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  processedActiveTrips: ReadonlyArray<ConvexVesselTrip>
): ReadonlyArray<ConvexVesselTrip> => {
  // Prefer processed rows while preserving untouched vessels.
  const mergedByVessel = new Map<string, ConvexVesselTrip>([
    ...existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
    ...processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
  ]);
  return [...mergedByVessel.values()];
};
