/**
 * Domain-owned scheduled dock-event contracts.
 */

/**
 * Stable dock event types used across scheduled, actual, and predicted rows.
 */
export type DockEventType = "dep-dock" | "arv-dock";

/**
 * Canonical persisted scheduled dock row.
 */
export type ConvexScheduledDockEvent = {
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  UpdatedAt: number;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  NextTerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  IsLastArrivalOfSailingDay?: boolean;
};

/**
 * Portable inferred segment used by continuity and timeline reads.
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
