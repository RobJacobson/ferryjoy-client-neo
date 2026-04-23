import { areTripStorageRowsEqual } from "domain/vesselOrchestration/shared";
import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import { detectTripEvents } from "./lifecycle";
import { buildTripRowsForPing } from "./tripBuilders";
import type { VesselTripUpdate } from "./types";

export const computeVesselTripUpdate = (input: {
  vesselLocation: VesselTripUpdate["vesselLocation"];
  existingActiveTrip?: VesselTripUpdate["existingActiveTrip"];
  scheduleTables: ScheduledSegmentTables;
}): VesselTripUpdate => {
  const events = detectTripEvents(
    input.existingActiveTrip,
    input.vesselLocation
  );
  const tripRows = buildTripRowsForPing(
    {
      vesselLocation: input.vesselLocation,
      existingActiveTrip: input.existingActiveTrip,
      events,
    },
    input.scheduleTables
  );
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
