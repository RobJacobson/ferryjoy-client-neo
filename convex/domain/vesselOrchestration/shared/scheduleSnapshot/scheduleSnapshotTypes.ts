import type { ConvexScheduledDockEvent } from "domain/events/scheduled";

/**
 * Serializable schedule read model for one orchestrator ping (prefetched in one
 * internal query, consumed by {@link createScheduledSegmentLookupFromSnapshot}).
 */
export type ScheduleSnapshot = {
  /**
   * Today's scheduled boundary events grouped by vessel.
   *
   * Lookup adapters derive segment-key and same-day views from this source.
   */
  eventsByVesselAbbrev: Record<string, ConvexScheduledDockEvent[]>;
};
