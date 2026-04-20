/**
 * Shared schedule-backed continuity types for docked identity resolution and
 * schedule snapshot wiring.
 */

import type { ConvexScheduledDockEvent } from "domain/events/scheduled/schemas";

/**
 * Provenance for which schedule continuity path selected the segment.
 */
export type DockedScheduledSegmentSource =
  | "completed_trip_next"
  | "rollover_schedule";

/**
 * Schedule lookup callbacks supplied by the functions layer for one tick.
 */
export type ScheduledSegmentLookup = {
  getScheduledDepartureEventBySegmentKey: (
    segmentKey: string
  ) => ConvexScheduledDockEvent | null;
  getScheduledDockEventsForSailingDay: (args: {
    vesselAbbrev: string;
    sailingDay: string;
  }) => ConvexScheduledDockEvent[];
};
