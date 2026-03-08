/**
 * Shared types for the VesselTripTimeline feature.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";

/**
 * Input item for the VesselTripTimeline list.
 */
export type TimelineItem = {
  trip: VesselTripWithScheduledTrip;
  vesselLocation: VesselLocation;
};

/** Segment kinds—panels between timestamps (at-dock = arrive-to-depart, at-sea = depart-to-arrive). */
export type RowKind = "at-dock" | "at-sea";

/**
 * Single point in time with scheduled, actual, and estimated values.
 * Reused from TimelineFeatures; define locally if that module is not accessible.
 */
export type TimePoint = {
  scheduled: Date;
  actual?: Date;
  estimated?: Date;
};

/** Left slot content kind. */
export type LeftContentKind = "terminal-label" | "in-transit-card" | "none";

/** Right slot content kind. */
export type RightContentKind = "time-events" | "none";

/** Layout bounds (y, height) for a timeline row; used to align overlay rows with measured rows. */
export type RowLayoutBounds = { y: number; height: number };

export type TimelineRowModel = {
  id: string;
  startTime: Date;
  endTime: Date;
  percentComplete: number;
  kind: RowKind;
  /** Event at segment start boundary (e.g., arrive for at-dock, depart for at-sea). */
  eventTimeStart: TimePoint;
  /** Event at segment end boundary (e.g., depart for at-dock, arrive for at-sea). */
  eventTimeEnd: TimePoint;
  /** For at-dock rows: which terminal. */
  terminalName?: string;
  leftContentKind: LeftContentKind;
  rightContentKind: RightContentKind;
  /** For at-sea rows when vesselLocation has distance data. */
  useDistanceProgress?: boolean;
  /** Per-row override for minimum height; 0 for last row when collapsible. */
  minHeight?: number;
};
