/**
 * Shared types for the VesselTripTimeline feature.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";

/**
 * Input item for the VesselTripTimeline list.
 */
export type VesselTripTimelineItem = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

export type VesselTripTimelinePhase = "departure" | "transit" | "arrival";

export type VesselTripTimelineRowModel = {
  id: string;
  startTime: Date;
  endTime: Date;
  percentComplete: number;
  phase: VesselTripTimelinePhase;
  indicatorLabel: string;
};
