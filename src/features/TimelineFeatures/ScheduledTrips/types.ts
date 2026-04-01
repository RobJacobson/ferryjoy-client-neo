/**
 * ScheduledTrips shared types.
 * Re-exports Segment and ScheduledTripJourney from shared; defines page data shape.
 * Rendering uses segments + vesselTripByKeys with PrevKey/NextKey for prev/next trip lookups.
 */

import type { VesselLocation, VesselTrip } from "@/types";
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
