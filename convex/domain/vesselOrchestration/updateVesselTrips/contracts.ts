/**
 * Public contracts for the pure trip-update pipeline.
 */

import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/** Arguments for {@link runUpdateVesselTrips}: one feed batch plus schedule snapshot. */
export type RunUpdateVesselTripsInput = {
  vesselLocations: ReadonlyArray<ConvexVesselLocation>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  scheduleContext: ScheduleSnapshot;
};

/** Pure pipeline output: trips completed this tick and the merged active set. */
export type RunUpdateVesselTripsOutput = {
  /** Authoritative active rows after this tick (names align with `functions/vesselTrips`). */
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
  completedTrips: ReadonlyArray<ConvexVesselTrip>;
};
