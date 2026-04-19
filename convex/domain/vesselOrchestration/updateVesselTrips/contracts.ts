/**
 * Canonical Stage A public contracts for the trips concern.
 */

import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { BuildTripCoreResult } from "./tripLifecycle/buildTrip";
import type { TripEvents } from "./tripLifecycle/tripEventTypes";

/**
 * Stage A keeps this shape intentionally small so later stages can preserve the
 * public handoff without forcing lifecycle cleanup now.
 */
export type TripComputation = {
  vesselAbbrev: string;
  branch: "completed" | "current";
  /**
   * Present when current internals carry the event set through to the public
   * wrapper. Completed-trip handoffs do not retain events in the current bundle.
   */
  events?: TripEvents;
  existingTrip?: ConvexVesselTrip;
  completedTrip?: ConvexVesselTrip;
  activeTrip?: ConvexVesselTrip;
  tripCore: {
    withFinalSchedule: BuildTripCoreResult["withFinalSchedule"];
    gates?: BuildTripCoreResult["gates"];
  };
};

/**
 * Plain-data schedule context preferred by the PRD. Stage A uses the existing
 * preloaded snapshot and converts it to legacy lookup adapters internally.
 */
export type VesselTripScheduleContext = ScheduleSnapshot;

export type RunUpdateVesselTripsInput = {
  tickStartedAt: number;
  vesselLocations: ReadonlyArray<ConvexVesselLocation>;
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>;
  scheduleContext: VesselTripScheduleContext;
};

export type RunUpdateVesselTripsOutput = {
  activeTrips: ConvexVesselTrip[];
  completedTrips: ConvexVesselTrip[];
  tripComputations: TripComputation[];
};
