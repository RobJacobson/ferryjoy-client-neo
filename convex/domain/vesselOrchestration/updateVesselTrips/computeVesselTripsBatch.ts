import { createScheduledSegmentTablesFromSnapshot } from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { computeVesselTripUpdate } from "./computeVesselTripUpdate";
import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
  VesselTripUpdate,
} from "./types";

type ComputeVesselTripsBatchInput = RunUpdateVesselTripsInput & {
  shouldProcessLocation?: (
    location: RunUpdateVesselTripsInput["vesselLocations"][number]
  ) => boolean;
};

type ComputeVesselTripsBatchResult = {
  updates: ReadonlyArray<VesselTripUpdate>;
  rows: RunUpdateVesselTripsOutput;
};

const activeTripsByVesselAbbrev = (
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): Map<string, ConvexVesselTrip> =>
  new Map(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

const mergeActiveTripRows = (
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>,
  processedActiveTrips: ReadonlyArray<ConvexVesselTrip>
): ReadonlyArray<ConvexVesselTrip> => {
  const mergedByVessel = new Map<string, ConvexVesselTrip>([
    ...existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
    ...processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
  ]);
  return [...mergedByVessel.values()];
};

export const computeVesselTripsBatch = (
  input: ComputeVesselTripsBatchInput
): ComputeVesselTripsBatchResult => {
  const scheduleTables = createScheduledSegmentTablesFromSnapshot(
    input.scheduleSnapshot,
    input.sailingDay
  );
  const existingActiveTripsByVessel = activeTripsByVesselAbbrev(
    input.existingActiveTrips
  );
  const vesselLocations =
    input.shouldProcessLocation === undefined
      ? input.vesselLocations
      : input.vesselLocations.filter(input.shouldProcessLocation);
  const updates = vesselLocations.map((vesselLocation) =>
    computeVesselTripUpdate({
      vesselLocation,
      existingActiveTrip: existingActiveTripsByVessel.get(
        vesselLocation.VesselAbbrev
      ),
      scheduleTables,
    })
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

export const computeVesselTripsRows = (
  input: RunUpdateVesselTripsInput
): RunUpdateVesselTripsOutput => computeVesselTripsBatch(input).rows;
