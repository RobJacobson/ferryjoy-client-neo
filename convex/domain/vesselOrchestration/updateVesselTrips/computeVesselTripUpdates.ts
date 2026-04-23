/**
 * Pure one-vessel trip-update helper for the orchestrator pipeline.
 *
 * This is the canonical Stage 2 extraction seam: one location row plus one
 * optional existing active trip in, one per-vessel change bundle out.
 */

import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import { calculateTripUpdateForVessel } from "./calculatedTripUpdate";
import { areTripStorageRowsEqual } from "./storageRowsEqual";
import { tripRowsForVesselPing } from "./tripRowsForVesselPing";
import type { VesselTripUpdates } from "./types";

export const computeVesselTripUpdates = (
  input: {
    vesselLocation: VesselTripUpdates["vesselLocation"];
    existingActiveTrip?: VesselTripUpdates["existingActiveTrip"];
    scheduleTables: ScheduledSegmentTables;
  }
): VesselTripUpdates => {
  const calculatedUpdate = calculateTripUpdateForVessel(input.vesselLocation, {
    [input.vesselLocation.VesselAbbrev]: input.existingActiveTrip,
  });
  const tripRows = tripRowsForVesselPing(calculatedUpdate, input.scheduleTables);
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
