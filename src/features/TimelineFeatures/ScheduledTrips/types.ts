/**
 * ScheduledTrips shared types.
 * Re-exports Segment from Timeline; defines ScheduledTripJourney (list/card shape).
 * Rendering uses segments + vesselTripByKeys with PrevKey/NextKey for prev/next trip lookups.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { Segment } from "../shared/types";

export type { Segment } from "../shared/types";

/** Journey shape for scheduled trips: list, resolver, and card all use this. */
export type ScheduledTripJourney = {
  id: string;
  vesselAbbrev: string;
  routeAbbrev: string;
  /** Departure time in epoch ms (from the scheduledTrips backend). */
  departureTime: number;
  segments: Segment[];
};

/** Props for presentational ScheduledTripList (data passed from container). */
export type ScheduledTripListPageData = {
  status: "loading" | "empty" | "ready";
  journeys: ScheduledTripJourney[] | undefined;
  vesselTripByKeys: Map<string, VesselTrip>;
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  currentTripByAbbrev: Map<string, VesselTrip>;
};
