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
