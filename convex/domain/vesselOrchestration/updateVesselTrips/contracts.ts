/**
 * Public contracts for the pure trip-update pipeline.
 */

import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Schedule-enriched trip proposal produced while resolving one vessel update.
 *
 * This remains an internal trip-owned type; it is not part of the public
 * `runUpdateVesselTrips` boundary.
 */
export type TripScheduleCoreResult = {
  readonly withFinalSchedule: ConvexVesselTrip;
};

export type RunUpdateVesselTripsInput = {
  vesselLocations: ReadonlyArray<ConvexVesselLocation>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  scheduleContext: ScheduleSnapshot;
};

export type RunUpdateVesselTripsOutput = {
  activeVesselTrips: ReadonlyArray<ConvexVesselTrip>;
  completedVesselTrips: ReadonlyArray<ConvexVesselTrip>;
};
