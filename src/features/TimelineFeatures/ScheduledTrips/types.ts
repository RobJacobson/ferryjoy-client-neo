/**
 * ScheduledTrips shared types.
 * Re-exports Segment from Timeline; defines ScheduledTripJourney (list/card shape).
 * Rendering uses segments + vesselTripMap with PrevKey/NextKey for prev/next trip lookups.
 */

import type { Segment } from "../Timeline/types";

export type { Segment } from "../Timeline/types";

/** Journey shape for scheduled trips: list, resolver, and card all use this. */
export type ScheduledTripJourney = {
  id: string;
  vesselAbbrev: string;
  routeAbbrev: string;
  /** Departure time in epoch ms (from the scheduledTrips backend). */
  departureTime: number;
  segments: Segment[];
};
