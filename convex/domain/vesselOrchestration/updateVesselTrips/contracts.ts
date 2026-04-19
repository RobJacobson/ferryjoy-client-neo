/**
 * Canonical Stage A public contracts for the trips concern.
 */

import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
  ConvexVesselTripWithPredictions,
} from "functions/vesselTrips/schemas";
import type { TripEvents } from "./tripLifecycle/tripEventTypes";

/**
 * Canonical normalized location row consumed by the trips pipeline.
 */
export type VesselLocationRow = ConvexVesselLocation;

/**
 * Persistable trip row emitted by the trips pipeline.
 */
export type VesselTripRow = ConvexVesselTrip;

/**
 * Current preloaded active-trip rows accepted during the Stage A transition.
 */
export type ExistingActiveTripRow =
  | ConvexVesselTrip
  | ConvexVesselTripWithPredictions;

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
  existingTrip?: ExistingActiveTripRow;
  completedTrip?: ConvexVesselTripWithML;
  activeTrip?: ConvexVesselTripWithPredictions;
  tripCore: {
    withFinalSchedule: ConvexVesselTripWithPredictions;
  };
};

/**
 * Plain-data schedule context preferred by the PRD. Stage A uses the existing
 * preloaded snapshot and converts it to legacy lookup adapters internally.
 */
export type VesselTripScheduleContext = ScheduleSnapshot;

export type RunUpdateVesselTripsInput = {
  tickStartedAt: number;
  vesselLocations: ReadonlyArray<VesselLocationRow>;
  existingActiveTrips: ReadonlyArray<ExistingActiveTripRow>;
  scheduleContext: VesselTripScheduleContext;
};

export type RunUpdateVesselTripsOutput = {
  activeTrips: VesselTripRow[];
  completedTrips: VesselTripRow[];
  tripComputations: TripComputation[];
};
