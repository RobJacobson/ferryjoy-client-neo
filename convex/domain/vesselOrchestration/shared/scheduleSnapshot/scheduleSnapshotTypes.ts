import type { ConvexInferredScheduledSegment } from "domain/events/scheduled";

/**
 * Serializable schedule read model for one orchestrator ping (prefetched in one
 * internal query, consumed by {@link createScheduledSegmentTablesFromSnapshot}).
 */
export type CompactScheduledDepartureEvent = {
  Key: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
};

export type ScheduleSnapshot = {
  /** Calendar day represented by this materialized snapshot. */
  SailingDay: string;
  /** Direct schedule lookups keyed by trip `ScheduleKey`. */
  scheduledDepartureBySegmentKey: Record<string, ConvexInferredScheduledSegment>;
  /** Ordered same-day departures for rollover continuity. */
  scheduledDeparturesByVesselAbbrev: Record<
    string,
    CompactScheduledDepartureEvent[]
  >;
};
