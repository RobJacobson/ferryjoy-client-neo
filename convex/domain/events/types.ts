/**
 * Shared domain types for intermediate dock-boundary event records.
 *
 * These records are in-memory reload inputs used to derive scheduled and actual
 * event-table rows. They are not a presentation shape and are not returned to
 * the client.
 */

import type { DockEventType } from "./scheduled";

export type DockBoundaryEventRecord = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  EventPredictedTime?: number;
  EventOccurred?: true;
  EventActualTime?: number;
};

/**
 * Verb-led alias for DockBoundaryEventRecord used by reload composition.
 *
 * The reload pipeline talks about dock transitions (a vessel leaving or
 * arriving at a dock) rather than abstract boundaries; this alias lets new
 * code adopt the clearer vocabulary without churning every existing import.
 */
export type DockTransitionRecord = DockBoundaryEventRecord;
