/**
 * Shared types for the VesselTripTimeline feature.
 * Owns the canonical document, render-state, and layout types used by the
 * pipeline and renderer. These types are feature-local and do not re-export
 * shared primitives.
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

/** Progress source for the active indicator within a row. */
type TimelineProgressMode = "time" | "distance";

/** Lifecycle phase of a row relative to the current active cursor. */
export type TimelineLifecyclePhase = "upcoming" | "active" | "completed";

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
type TimelineBoundary = {
  terminalAbbrev?: string;
  timePoint: TimePoint;
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
  geometryMinutes: number;
  fallbackDurationMinutes: number;
  progressMode: TimelineProgressMode;
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
  eventType: "arrive" | "depart";
  currTerminalAbbrev?: string;
  currTerminalDisplayName?: string;
  nextTerminalAbbrev?: string;
  timePoint: TimePoint;
};

/**
 * Render-ready row state consumed by the renderer.
 * Each row shows only its start boundary; the next row's start is the end of
 * the previous segment. `isFinalRow: true` for the last row; it has no
 * duration-based height (circle + labels only).
 */
export type TimelineRenderRow = {
  id: string;
  kind: SegmentKind;
  markerAppearance: "past" | "future";
  segmentIndex: number;
  geometryMinutes: number;
  startLabel: string;
  showStartTimePlaceholder: boolean;
  terminalHeadline?: string;
  startBoundary: TimelineRenderBoundary;
  endBoundary?: TimelineRenderBoundary;
  isFinalRow: boolean;
};

/**
 * Active indicator state for the full-timeline overlay.
 */
export type TimelineActiveIndicator = {
  rowId: string;
  positionPercent: number;
  label: string;
  title?: string;
  subtitle?: string;
  animate?: boolean;
  speedKnots?: number;
};

/**
 * Render-ready timeline state derived from the canonical document.
 */
export type TimelineRenderState = {
  rows: TimelineRenderRow[];
  activeIndicator: TimelineActiveIndicator | null;
};
