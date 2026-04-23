/**
 * Pure one-vessel trip-update helper for the orchestrator pipeline.
 *
 * This is the canonical Stage 2 extraction seam: one location row plus one
 * optional existing active trip in, one per-vessel change bundle out. Joins
 * the feed row to the prior active and runs {@link detectTripEvents} here
 * before {@link tripRowsForVesselPing}.
 */

import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";
import { areTripStorageRowsEqual } from "./storageRowsEqual";
import { tripRowsForVesselPing } from "./tripRowsForVesselPing";
import type { CalculatedTripUpdate, VesselTripUpdates } from "./types";

export const computeVesselTripUpdates = (input: {
  vesselLocation: VesselTripUpdates["vesselLocation"];
  existingActiveTrip?: VesselTripUpdates["existingActiveTrip"];
  scheduleTables: ScheduledSegmentTables;
}): VesselTripUpdates => {
  const calculatedUpdate: CalculatedTripUpdate = {
    vesselLocation: input.vesselLocation,
    existingActiveTrip: input.existingActiveTrip,
    events: detectTripEvents(input.existingActiveTrip, input.vesselLocation),
  };
  const tripRows = tripRowsForVesselPing(
    calculatedUpdate,
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
