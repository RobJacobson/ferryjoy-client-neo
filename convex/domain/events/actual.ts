/**
 * Domain-owned actual dock-event contracts.
 */

import type { DockEventType } from "./scheduled";

/**
 * Persisted actual dock row.
 */
export type ConvexActualDockEvent = {
  EventKey: string;
  TripKey: string;
  ScheduleKey?: string;
  EventType: DockEventType;
  VesselAbbrev: string;
  SailingDay: string;
  UpdatedAt: number;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventOccurred?: true;
  EventActualTime?: number;
};

/**
 * Sparse actual dock write at ingestion / pre-enrichment boundaries.
 */
export type ConvexActualDockWrite = {
  TripKey?: string;
  ScheduleKey?: string;
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
 * Write with a physical `TripKey`.
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
