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

/** Status for a segment in the timeline. */
export type SegmentStatus = "past" | "ongoing" | "future";

/** Phase for bar display (at-dock, at-sea, completed, pending). */
export type SegmentPhase = "at-dock" | "at-sea" | "completed" | "pending";

/**
 * TripSegment represents a single leg of a journey with all data needed for rendering.
 * Standardized on "curr" and "next" for origin/destination terminals.
 * Use toAtDockSegment / toAtSeaSegment to derive segment-specific views.
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
  status: SegmentStatus;
  phase: SegmentPhase;
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
 * AtDockSegment: data for the at-dock block (arrive at origin → at dock → depart).
 * Separate concern from at-sea.
 */
export type AtDockSegment = {
  currTerminal: TerminalInfo;
  arriveCurr: TimePoint;
  leaveCurr: TimePoint;
  isArrived: boolean;
  isHeld: boolean;
  status: SegmentStatus;
  phase: SegmentPhase;
};

/**
 * AtSeaSegment: data for the at-sea block (depart → at sea → arrive at destination).
 * Separate concern from at-dock.
 */
export type AtSeaSegment = {
  currTerminal: TerminalInfo;
  nextTerminal: TerminalInfo;
  leaveCurr: TimePoint;
  arriveNext: TimePoint;
  isLeft: boolean;
  isHeld: boolean;
  status: SegmentStatus;
  phase: SegmentPhase;
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

/** Status for timeline bar segments (Pending, InProgress, Completed). */
export type TimelineBarStatus = "Pending" | "InProgress" | "Completed";

/** Journey shape for scheduled trips: list, resolver, and card all use this. */
export type ScheduledTripJourney = {
  id: string;
  vesselAbbrev: string;
  routeAbbrev: string;
  /** Departure time as Date object (converted from Convex epoch ms). */
  departureTime: Date;
  segments: Segment[];
};

/** Real-time phase for the active segment (used by ScheduledTrips display state). */
export type TimelineActivePhase = "AtDock" | "AtSea" | "Unknown";
