/**
 * ScheduledTrips shared types.
 * Re-exports Segment and ScheduledTripJourney from shared; defines page data shape.
 * Rendering uses segments + vesselTripByKeys with PrevKey/NextKey for prev/next trip lookups.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { ScheduledTripJourney } from "../shared/types";

export type { ScheduledTripJourney, Segment } from "../shared/types";

/** Props for presentational ScheduledTripList (data passed from container). */
export type ScheduledTripListPageData = {
  status: "loading" | "empty" | "ready";
  journeys: ScheduledTripJourney[] | undefined;
  vesselTripByKeys: Map<string, VesselTrip>;
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  currentTripByAbbrev: Map<string, VesselTrip>;
};
