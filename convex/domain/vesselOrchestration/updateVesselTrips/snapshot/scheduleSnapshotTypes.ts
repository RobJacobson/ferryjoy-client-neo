import type { ConvexScheduledDockEvent } from "domain/events/scheduled";

/**
 * Serializable schedule read model for one orchestrator tick (prefetched in one
 * internal query, consumed by {@link createScheduledSegmentLookupFromSnapshot}).
 */
export type ScheduleSnapshot = {
  /** Departure `eventsScheduled` row keyed by trip segment key (`ScheduleKey`). */
  departuresBySegmentKey: Record<string, ConvexScheduledDockEvent>;
  /**
   * Same-day boundary events for a vessel + sailing day.
   * Keyed by {@link scheduleSnapshotCompositeKey}.
   */
  sameDayEventsByCompositeKey: Record<string, ConvexScheduledDockEvent[]>;
};
