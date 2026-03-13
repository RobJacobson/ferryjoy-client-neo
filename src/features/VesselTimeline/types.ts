/**
 * Shared types for the VesselTimeline feature.
 *
 * These types describe the canonical day-level timeline document and render
 * state. The feature starts from normalized vessel-day timeline trips supplied
 * by the Convex vessel-day context.
 */

import type { VesselTimelineTrip } from "@/data/contexts";

/**
 * Input item for day-level vessel timeline builders.
 */
export type VesselTimelineItem = {
  trips: VesselTimelineTrip[];
};

/**
 * Supported row kinds for the day-level timeline.
 */
export type VesselTimelineRowKind = "dock" | "sea";

/**
 * Display strategy for a row.
 */
export type VesselTimelineRowDisplayMode =
  | "proportional"
  | "compressed-dock-break";

/**
 * Overlay indicator state for the day-level timeline.
 */
export type VesselTimelineIndicatorState =
  | "active"
  | "pinned-break"
  | "inactive-warning";

/**
 * Generic time point used by timeline boundaries.
 */
export type VesselTimelineTimePoint = {
  scheduled?: Date;
  actual?: Date;
  estimated?: Date;
};

/**
 * Row boundary information used by the canonical document.
 */
export type VesselTimelineBoundary = {
  terminalAbbrev?: string;
  timePoint: VesselTimelineTimePoint;
};

/**
 * Canonical row model for the vessel-day timeline.
 */
export type VesselTimelineRow = {
  id: string;
  segmentIndex: number;
  kind: VesselTimelineRowKind;
  startBoundary: VesselTimelineBoundary;
  endBoundary: VesselTimelineBoundary;
  actualDurationMinutes: number;
  displayDurationMinutes: number;
  displayMode: VesselTimelineRowDisplayMode;
  compression?: {
    thresholdMinutes: number;
    visibleArrivalMinutes: number;
    visibleDepartureMinutes: number;
  };
};

/**
 * Canonical day-level timeline document.
 */
export type VesselTimelineDocument = {
  rows: VesselTimelineRow[];
  activeSegmentIndex: number;
  indicatorState: VesselTimelineIndicatorState;
};

/**
 * Layout config for deterministic vessel timeline sizing.
 */
export type VesselTimelineLayoutConfig = {
  pixelsPerMinute: number;
  minRowHeightPx: number;
  compressedBreakThresholdMinutes: number;
  compressedBreakMarkerHeightPx: number;
  compressedBreakStubMinutes: number;
  compressedBreakDepartureWindowMinutes: number;
  initialAutoScroll: "center-active-indicator" | "center-active-row" | "none";
  initialScrollAnchorPercent: number;
};

/**
 * Render-ready boundary data.
 */
export type VesselTimelineRenderBoundary = {
  label: string;
  terminalAbbrev?: string;
  timePoint: VesselTimelineTimePoint;
};

/**
 * Render-ready row model.
 */
export type VesselTimelineRenderRow = {
  id: string;
  kind: VesselTimelineRowKind;
  startBoundary: VesselTimelineRenderBoundary;
  endBoundary: VesselTimelineRenderBoundary;
  displayHeightPx: number;
  topPx: number;
  displayMode: VesselTimelineRowDisplayMode;
  segmentIndex: number;
};

/**
 * Render-ready active indicator state.
 */
export type VesselTimelineActiveIndicator = {
  rowId: string;
  rowIndex: number;
  topPx: number;
  label: string;
  state: VesselTimelineIndicatorState;
};

/**
 * Final render state consumed by the timeline UI.
 */
export type VesselTimelineRenderState = {
  rows: VesselTimelineRenderRow[];
  activeIndicator: VesselTimelineActiveIndicator | null;
  contentHeightPx: number;
  layout: VesselTimelineLayoutConfig;
};
