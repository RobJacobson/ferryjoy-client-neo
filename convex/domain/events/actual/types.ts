/**
 * Actual event domain types.
 *
 * These sparse write shapes represent actual dock-event evidence before it is
 * normalized into persisted eventsActual rows by the actual event domain.
 */

import type { DockEventType } from "../common/types";

/**
 * Sparse actual dock write at ingestion and pre-enrichment boundaries.
 */
type ConvexActualDockWrite = {
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
 * Write fields with resolved physical trip identity omitted.
 */
type ConvexActualDockWriteBase = Omit<ConvexActualDockWrite, "TripKey">;

/**
 * Write carrying the physical TripKey required by eventsActual.
 */
type ConvexActualDockWriteWithTripKey = ConvexActualDockWriteBase & {
  TripKey: string;
};

/**
 * Anchor fields that make a sparse actual write safe to persist.
 */
type ActualDockWriteAnchor =
  | { EventActualTime: number; ScheduledDeparture?: number }
  | { EventActualTime?: number; ScheduledDeparture: number };

/**
 * Write ready to normalize into a persisted actual event row.
 */
type ConvexActualDockWritePersistable = ConvexActualDockWriteBase & {
  TripKey: string;
} & ActualDockWriteAnchor;

export type {
  ActualDockWriteAnchor,
  ConvexActualDockWrite,
  ConvexActualDockWriteBase,
  ConvexActualDockWritePersistable,
  ConvexActualDockWriteWithTripKey,
};
