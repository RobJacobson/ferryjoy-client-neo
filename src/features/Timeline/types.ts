/**
 * Shared types for Timeline components.
 */

/**
 * Segment type representing a single leg of a journey.
 */
export type Segment = {
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DisplayArrivingTerminalAbbrev?: string;
  DepartingTime: Date;
  ArrivingTime?: Date;
  SchedArriveNext?: Date;
  SchedArriveCurr?: Date;
  NextDepartingTime?: Date;
  DirectKey?: string;
  /** Previous segment Key in the linked-list chain; used for prev/next trip lookups. */
  PrevKey?: string;
  /** Next segment Key in the linked-list chain; used for prev/next trip lookups. */
  NextKey?: string;
  Key: string;
  /** WSF operational day YYYY-MM-DD; used for completed trip lookups */
  SailingDay?: string;
};

export type TimelineSegmentStatus = "Pending" | "InProgress" | "Completed";

/** Real-time phase for the active segment (used by ScheduledTrips display state). */
export type TimelineActivePhase = "AtDock" | "AtSea" | "Unknown";
