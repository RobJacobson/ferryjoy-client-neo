/**
 * Shared types for the VesselTripTimeline feature.
 * Owns the event-first pipeline, render-state, and layout types used by the
 * feature-local trip timeline renderer. These types are local to the feature
 * and do not re-export shared renderer primitives.
 */

import type { VesselLocation, VesselTripWithScheduledTrip } from "@/types";

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
 * Ordered boundary event used to derive timeline rows.
 */
export type TimelineEvent = {
  eventType: "arrive" | "depart";
  terminalAbbrev?: string;
  timePoint: TimePoint;
};

/**
 * Feature-owned row derived from adjacent ordered events.
 */
export type TimelineRow = {
  rowId: string;
  kind: SegmentKind;
  startEvent: TimelineEvent;
  endEvent: TimelineEvent;
  geometryMinutes: number;
  fallbackDurationMinutes: number;
  progressMode: TimelineProgressMode;
};

/**
 * Active derived row selected from the current timeline rows.
 */
export type ActiveTimelineRow = {
  row: TimelineRow;
  rowIndex: number;
  isComplete: boolean;
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
 * Render-ready timeline state returned by the feature-local pipeline.
 */
export type TimelineRenderState = {
  rows: TimelineRenderRow[];
  activeIndicator: TimelineActiveIndicator | null;
};

export type TimelinePipelineInput = {
  item: TimelineItem;
  getTerminalNameByAbbrev: (terminalAbbrev: string) => string | null;
  now: Date;
};

export type TimelinePipelineWithEvents = TimelinePipelineInput & {
  events: TimelineEvent[];
};

export type TimelinePipelineWithRows = TimelinePipelineWithEvents & {
  rows: TimelineRow[];
};

export type TimelinePipelineWithActiveRow = TimelinePipelineWithRows & {
  activeRow: ActiveTimelineRow | null;
};

export type TimelinePipelineWithRenderRows = TimelinePipelineWithActiveRow & {
  renderRows: TimelineRenderRow[];
};

export type TimelinePipelineWithActiveIndicator =
  TimelinePipelineWithRenderRows & {
    activeIndicator: TimelineActiveIndicator | null;
  };
