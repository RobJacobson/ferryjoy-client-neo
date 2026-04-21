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
 * Prefetched schedule rows for one orchestrator ping, keyed for direct lookup.
 *
 * `scheduledDepartureBySegmentKey` indexes **departure** boundaries (`dep-dock`)
 * by segment key (see {@link getSegmentKeyFromBoundaryKey}).
 *
 * `scheduledDockEventsByVesselAbbrev` holds the same-day **boundary** sequence
 * per vessel — both `dep-dock` and `arv-dock` — in feed order. Trip helpers
 * such as {@link inferScheduledSegmentFromDepartureEvent} and
 * {@link findNextDepartureEvent} filter to departures internally; keeping the
 * full boundary list matches the schedule snapshot and avoids splitting
 * arrivals into a parallel structure unless a caller needs that explicitly.
 */
export type ScheduledSegmentTables = {
  /** Calendar day these tables were narrowed to from the snapshot. */
  sailingDay: string;
  scheduledDepartureBySegmentKey: Readonly<
    Record<string, ConvexScheduledDockEvent>
  >;
  scheduledDockEventsByVesselAbbrev: Readonly<
    Record<string, readonly ConvexScheduledDockEvent[]>
  >;
};
