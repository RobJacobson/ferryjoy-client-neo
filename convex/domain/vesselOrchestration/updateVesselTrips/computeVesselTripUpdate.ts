import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import { detectTripEvents } from "./lifecycle";
import { areTripStorageRowsEqual } from "./storage";
import { buildTripRowsForPing } from "./tripBuilders";
import type { VesselTripUpdates } from "./types";

type CalculatedTripUpdate = {
  vesselLocation: VesselTripUpdates["vesselLocation"];
  existingActiveTrip?: VesselTripUpdates["existingActiveTrip"];
  events: ReturnType<typeof detectTripEvents>;
};

export const computeVesselTripUpdate = (input: {
  vesselLocation: VesselTripUpdates["vesselLocation"];
  existingActiveTrip?: VesselTripUpdates["existingActiveTrip"];
  scheduleTables: ScheduledSegmentTables;
}): VesselTripUpdates => {
  const calculatedUpdate: CalculatedTripUpdate = {
    vesselLocation: input.vesselLocation,
    existingActiveTrip: input.existingActiveTrip,
    events: detectTripEvents(input.existingActiveTrip, input.vesselLocation),
  };
  const tripRows = buildTripRowsForPing(calculatedUpdate, input.scheduleTables);
  const activeTripCandidate = tripRows.activeVesselTrip;
  const completedTrip = tripRows.completedVesselTrip;
  const replacementTrip =
    completedTrip !== undefined &&
    activeTripCandidate !== undefined &&
    activeTripCandidate.TripKey !== completedTrip.TripKey
      ? activeTripCandidate
      : undefined;

  return {
    vesselLocation: input.vesselLocation,
    existingActiveTrip: input.existingActiveTrip,
    activeTripCandidate,
    completedTrip,
    replacementTrip,
    tripStorageChanged: !areTripStorageRowsEqual(
      input.existingActiveTrip,
      activeTripCandidate
    ),
    tripLifecycleChanged:
      completedTrip !== undefined || replacementTrip !== undefined,
  };
};

export const computeVesselTripUpdates = computeVesselTripUpdate;
