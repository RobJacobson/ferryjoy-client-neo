/**
 * ScheduledTrips shared types.
 * Re-exports Segment from Timeline; defines ScheduledTripJourney (list/card shape) and
 * SegmentTuple (pipeline output: one per scheduled segment with optional overlay trip).
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
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

/**
 * Pipeline 1 output: one tuple per scheduled segment with optional actual/predicted trip by Key.
 * Schedule is primary; actualTrip is the decorator (active wins over completed for same Key).
 */
export type SegmentTuple = {
  segment: Segment;
  /** Actual/predicted trip for this segment Key (completed or active), when available. */
  actualTrip?: VesselTrip;
  journeyId: string;
  vesselAbbrev: string;
  segmentIndex: number;
};
