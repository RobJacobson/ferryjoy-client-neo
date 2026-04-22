/**
 * Shared schedule-backed lookup types for compact schedule snapshot wiring.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { CompactScheduledDepartureEvent } from "../scheduleSnapshot/scheduleSnapshotTypes";

/**
 * Prefetched schedule rows for one orchestrator ping, keyed for direct lookup.
 *
 * `scheduledDepartureBySegmentKey` stores the already-inferred schedule
 * segment contract keyed by `ScheduleKey`.
 *
 * `scheduledDeparturesByVesselAbbrev` keeps the ordered departure sequence per
 * vessel for same-day rollover continuity.
 */
export type ScheduledSegmentTables = {
  /** Calendar day these tables were narrowed to from the snapshot. */
  sailingDay: string;
  scheduledDepartureBySegmentKey: Readonly<Record<string, ConvexInferredScheduledSegment>>;
  scheduledDeparturesByVesselAbbrev: Readonly<
    Record<string, readonly CompactScheduledDepartureEvent[]>
  >;
};
