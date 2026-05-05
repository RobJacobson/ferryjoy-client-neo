/**
 * Shared domain types for dock events: in-memory reload inputs, sparse actual
 * writes used before persistence, and portable inferred schedule segments. Persisted
 * table row shapes live under functions/events table schema modules.
 */

import type { DockEventType } from "functions/events/eventsScheduled/schemas";

/**
 * In-memory reload inputs used to derive scheduled and actual event-table rows.
 * Not a presentation shape and not returned to the client.
 */
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

/**
 * Sparse actual dock write at ingestion / pre-enrichment boundaries.
 */
export type ConvexActualDockWrite = {
  TripKey?: string;
  VesselAbbrev: string;
  SailingDay?: string;
  ScheduledDeparture?: number;
  TerminalAbbrev: string;
  EventActualTime?: number;
  SegmentKey?: string;
  EventType: DockEventType;
  EventOccurred: true;
  EventKey?: string;
};

/**
 * Write fields with resolved physical trip identity.
 */
export type ConvexActualDockWriteBase = Omit<ConvexActualDockWrite, "TripKey">;

/**
 * Write with a physical TripKey.
 */
export type ConvexActualDockWriteWithTripKey = ConvexActualDockWriteBase & {
  TripKey: string;
};

/**
 * Write ready for persistence normalization.
 */
export type ActualDockWriteAnchor =
  | { EventActualTime: number; ScheduledDeparture?: number }
  | { EventActualTime?: number; ScheduledDeparture: number };

/**
 * Write ready to normalize into a persisted actual row.
 */
export type ConvexActualDockWritePersistable = ConvexActualDockWriteBase & {
  TripKey: string;
} & ActualDockWriteAnchor;

/**
 * Portable inferred segment used by continuity and timeline reads (not a table row).
 */
export type ConvexInferredScheduledSegment = {
  Key: string;
  SailingDay: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  NextKey?: string;
  NextDepartingTime?: number;
};
