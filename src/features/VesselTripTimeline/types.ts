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

/** Segment kinds—panels between timeline boundary points. */
export type SegmentKind = "at-dock" | "at-sea";

/** Segment lifecycle relative to the vessel's current position. */
export type SegmentPhase = "upcoming" | "active" | "completed";

/**
 * Single point in time with scheduled, actual, and estimated values.
 * All fields are optional; when data is absent, consumers should handle undefined.
 */
export type TimePoint = {
  scheduled?: Date;
  actual?: Date;
  estimated?: Date;
};

/**
 * Canonical segment model for the feature timeline.
 * Segments are ordered and share adjacent boundary TimePoints.
 */
export type TimelineSegment = {
  id: string;
  segmentIndex: number;
  kind: SegmentKind;
  startPoint: TimePoint;
  endPoint: TimePoint;
  startTerminalAbbrev: string;
  endTerminalAbbrev: string;
  rendersEndLabel?: boolean;
  fallbackDurationMinutes: number;
};

/**
 * Ordered canonical segment list plus the active segment cursor.
 * `activeSegmentIndex` may be:
 * - `-1` when no segment has started yet
 * - `0..segments.length - 1` when a segment is active
 * - `segments.length` when all segments are completed
 */
export type TimelineSegmentsModel = {
  segments: TimelineSegment[];
  activeSegmentIndex: number;
};

/** Layout bounds (y, height) for a timeline row; used to align overlay rows with measured rows. */
export type RowLayoutBounds = { y: number; height: number };

/**
 * Feature-level presentation row derived from a canonical segment.
 */
export type TimelineRowModel = TimelineSegment & {
  durationMinutes: number;
  useDistanceProgress?: boolean;
  minHeight?: number;
};

/**
 * Feature-level presentation model passed to the timeline renderer.
 */
export type TimelinePresentationModel = {
  rows: TimelineRowModel[];
  activeSegmentIndex: number;
};
