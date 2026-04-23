/**
 * Batch trip update computation across vessel location rows.
 */
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { computeVesselTripUpdate } from "./computeVesselTripUpdate";
import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
  VesselTripUpdate,
} from "./types";

type TripLocationFilter = (location: ConvexVesselLocation) => boolean;

type ComputeVesselTripsBatchInput = RunUpdateVesselTripsInput & {
  shouldProcessLocation?: TripLocationFilter;
};

type ComputeVesselTripsBatchResult = {
  updates: ReadonlyArray<VesselTripUpdate>;
  rows: RunUpdateVesselTripsOutput;
};

/**
 * Computes trip updates for a batch of vessel locations.
 *
 * @param input - Batch input containing locations, active trips, and schedule data
 * @returns Per-vessel updates and merged active/completed trip rows
 */
export const computeVesselTripsBatch = async (
  input: ComputeVesselTripsBatchInput
): Promise<ComputeVesselTripsBatchResult> => {
  const existingActiveTripsByVessel = activeTripsByVesselAbbrev(
    input.existingActiveTrips
  );
  // Optionally narrow processing for targeted replays/tests.
  const vesselLocations =
    input.shouldProcessLocation === undefined
      ? input.vesselLocations
      : input.vesselLocations.filter(input.shouldProcessLocation);
  // Compute each vessel in isolation using the same schedule evidence.
  const updates = await Promise.all(
    vesselLocations.map((vesselLocation) =>
      computeVesselTripUpdate({
        vesselLocation,
        existingActiveTrip: existingActiveTripsByVessel.get(
          vesselLocation.VesselAbbrev
        ),
        scheduleAccess: input.scheduleAccess,
      })
    )
  );
  const activeTripCandidates = updates
    .map((update) => update.activeTripCandidate)
    .filter((trip): trip is ConvexVesselTrip => trip !== undefined);
  const completedTrips = updates
    .map((update) => update.completedTrip)
    .filter((trip): trip is ConvexVesselTrip => trip !== undefined);

  return {
    updates,
    rows: {
      completedTrips,
      activeTrips: mergeActiveTripRows(
        input.existingActiveTrips,
        activeTripCandidates
      ),
    },
  };
};

/**
 * Computes only persisted trip rows for a batch input.
 *
 * @param input - Batch input containing locations, active trips, and schedule data
 * @returns Active and completed trip rows ready for persistence
 */
export const computeVesselTripsRows = async (
  input: RunUpdateVesselTripsInput
): Promise<RunUpdateVesselTripsOutput> =>
  (await computeVesselTripsBatch(input)).rows;

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
