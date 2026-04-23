/**
 * Shared schedule-backed lookup types for compact schedule snapshot wiring.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { CompactScheduledDepartureEvent } from "../scheduleSnapshot/scheduleSnapshotTypes";

/**
 * Prefetched schedule evidence for one orchestrator ping, keyed for direct
 * lookup during trip-field inference.
 *
 * `scheduledDepartureBySegmentKey` stores direct schedule evidence keyed by
 * `ScheduleKey`.
 *
 * `scheduledDeparturesByVesselAbbrev` keeps the ordered departure sequence per
 * vessel for same-day rollover inference when WSF trip fields are incomplete.
 */
export type ScheduledSegmentTables = {
  /** Calendar day these tables were narrowed to from the snapshot. */
  sailingDay: string;
  scheduledDepartureBySegmentKey: Readonly<Record<string, ConvexInferredScheduledSegment>>;
  scheduledDeparturesByVesselAbbrev: Readonly<
    Record<string, readonly CompactScheduledDepartureEvent[]>
  >;
};
