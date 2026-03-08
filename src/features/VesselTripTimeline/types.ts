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

/** Segment kinds rendered by the vessel timeline. */
export type SegmentKind = "at-dock" | "at-sea";

/** Row sizing mode for the shared timeline primitive. */
export type TimelineLayoutMode = "duration" | "content";

/** Progress source for the active indicator within a row. */
export type TimelineProgressMode = "time" | "distance";

/**
 * Single point in time with scheduled, actual, and estimated values.
 * All fields are optional; when data is absent, consumers should handle
 * undefined.
 */
export type TimePoint = {
  scheduled?: Date;
  actual?: Date;
  estimated?: Date;
};

/**
 * Boundary data owned by a timeline row.
 */
export type TimelineBoundary = {
  terminalAbbrev?: string;
  timePoint: TimePoint;
};

/**
 * Explicit boundary ownership for a row's rendered labels and times.
 */
export type TimelineBoundaryOwnership = {
  start: true;
  end: boolean;
};

/**
 * Canonical document row for the feature timeline.
 * Rows are ordered, share adjacent boundary points, and carry only the data
 * needed to derive the current render state.
 */
export type TimelineDocumentRow = {
  id: string;
  segmentIndex: number;
  kind: SegmentKind;
  startBoundary: TimelineBoundary;
  endBoundary: TimelineBoundary;
  boundaryOwnership: TimelineBoundaryOwnership;
  geometryMinutes: number;
  fallbackDurationMinutes: number;
  progressMode: TimelineProgressMode;
  layoutMode: TimelineLayoutMode;
};

/**
 * Canonical feature-owned timeline document plus the active row cursor.
 * `activeSegmentIndex` may be:
 * - `0..rows.length - 1` when a row is active
 * - `rows.length` when all rows are completed
 */
export type TimelineDocument = {
  rows: TimelineDocumentRow[];
  activeSegmentIndex: number;
};

/** Layout bounds (y, height) for a timeline row; used to align the overlay. */
export type RowLayoutBounds = { y: number; height: number };

/**
 * Render-ready boundary label and timepoint for one side of a row.
 */
export type TimelineRenderBoundary = {
  label: string;
  terminalAbbrev?: string;
  timePoint: TimePoint;
};

/**
 * Render-ready row state consumed by the renderer.
 */
export type TimelineRenderRow = {
  id: string;
  kind: SegmentKind;
  segmentIndex: number;
  percentComplete: number;
  geometryMinutes: number;
  layoutMode: TimelineLayoutMode;
  startBoundary: TimelineRenderBoundary;
  endBoundary?: TimelineRenderBoundary;
};

/**
 * Active indicator state for the full-timeline overlay.
 */
export type TimelineActiveIndicator = {
  rowId: string;
  rowIndex: number;
  positionPercent: number;
  label: string;
};

/**
 * Render-ready timeline state derived from the canonical document.
 */
export type TimelineRenderState = {
  rows: TimelineRenderRow[];
  activeIndicator: TimelineActiveIndicator | null;
};
