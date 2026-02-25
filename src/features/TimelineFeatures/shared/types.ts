/**
 * Shared types for Timeline components.
 */

/**
 * TimePoint represents a single point in time with scheduled, actual, and estimated values.
 */
export type TimePoint = {
  scheduled: Date;
  actual?: Date;
  estimated?: Date;
};

/**
 * TerminalInfo represents a ferry terminal with its abbreviation and optional full name.
 */
export type TerminalInfo = {
  abbrev: string;
  name?: string;
};

/**
 * TripSegment represents a single leg of a journey with all data needed for rendering.
 * Standardized on "curr" and "next" for origin/destination terminals.
 */
export type TripSegment = {
  id: string;
  vesselAbbrev: string;
  vesselName?: string;

  // Terminal Info
  currTerminal: TerminalInfo;
  nextTerminal: TerminalInfo;

  // Time Points
  arriveCurr: TimePoint; // When it arrived at the starting terminal
  leaveCurr: TimePoint; // When it departed the starting terminal
  arriveNext: TimePoint; // When it arrives at the destination

  // Status & Progress
  status: "past" | "ongoing" | "future";
  phase: "at-dock" | "at-sea" | "completed" | "pending";
  progress?: number; // 0-1 for ongoing segments

  // Real-time metadata
  speed?: number;
  /** Distance in miles from departing terminal (when at sea). */
  departingDistance?: number;
  /** Distance in miles to arriving terminal (when at sea). */
  arrivingDistance?: number;
  isHeld: boolean;
  isArrived: boolean;
  isLeft: boolean;
};

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
