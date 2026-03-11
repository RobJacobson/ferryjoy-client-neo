/**
 * Shared types for the VesselTripTimeline feature.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import type {
  TimelineActiveIndicator as SharedTimelineActiveIndicator,
  TimelineDocument as SharedTimelineDocument,
  TimelineDocumentRow as SharedTimelineDocumentRow,
  TimelineLayoutMode as SharedTimelineLayoutMode,
  TimelineRenderRow as SharedTimelineRenderRow,
  TimelineRenderState as SharedTimelineRenderState,
} from "@/components/Timeline";

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
export type TimelineLayoutMode = SharedTimelineLayoutMode;

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
 * Canonical document row for the feature timeline.
 * Rows are ordered, share adjacent boundary points, and carry only the data
 * needed to derive the current render state.
 */
export type TimelineDocumentRow = SharedTimelineDocumentRow<
  SegmentKind,
  TimelineBoundary,
  TimelineProgressMode
>;

/**
 * Canonical feature-owned timeline document plus the active row cursor.
 * `activeSegmentIndex` may be:
 * - `0..rows.length - 1` when a row is active
 * - `rows.length` when all rows are completed
 */
export type TimelineDocument = SharedTimelineDocument<TimelineDocumentRow>;

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
 * Each row shows only its start boundary; the next row's start is the end of the previous segment.
 * isFinalRow: true for the last row; it has no duration-based height (circle + labels only).
 */
export type TimelineRenderRow = SharedTimelineRenderRow<
  SegmentKind,
  TimelineRenderBoundary
> & { isFinalRow: boolean };

/**
 * Active indicator state for the full-timeline overlay.
 */
export type TimelineActiveIndicator = SharedTimelineActiveIndicator<string>;

/**
 * Render-ready timeline state derived from the canonical document.
 */
export type TimelineRenderState = SharedTimelineRenderState<
  TimelineRenderRow,
  TimelineActiveIndicator
>;
