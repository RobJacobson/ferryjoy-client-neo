/**
 * Per-vessel trip update computation from one location ping.
 */
import { areTripStorageRowsEqual } from "domain/vesselOrchestration/shared";
import type { ScheduleContinuityAccess } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { detectTripEvents } from "./lifecycle";
import { buildTripRowsForPing } from "./tripBuilders";
import type { VesselTripUpdate } from "./types";

type ComputeVesselTripUpdateInput = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  scheduleAccess: ScheduleContinuityAccess;
};

/**
 * Computes storage and lifecycle changes for one vessel ping.
 *
 * @param input - Vessel location, optional active trip, and schedule lookup tables
 * @returns Trip update containing candidate rows and change indicators
 */
export const computeVesselTripUpdate = async (
  input: ComputeVesselTripUpdateInput
): Promise<VesselTripUpdate> => {
  // Detect lifecycle transitions before mutating trip rows.
  const events = detectTripEvents(
    input.existingActiveTrip,
    input.vesselLocation
  );
  // Build candidate rows from lifecycle and schedule evidence.
  const tripRows = await buildTripRowsForPing(
    {
      vesselLocation: input.vesselLocation,
      existingActiveTrip: input.existingActiveTrip,
      events,
    },
    input.scheduleAccess
  );
  const activeTripCandidate = tripRows.activeVesselTrip;
  const completedTrip = tripRows.completedVesselTrip;
  // Treat a different active TripKey after completion as a replacement start.
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
