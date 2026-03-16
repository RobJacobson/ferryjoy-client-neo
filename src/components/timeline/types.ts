/**
 * Shared UI types for vertical timeline renderer components.
 *
 * These types intentionally capture only the rendering contract required by
 * the shared timeline components, not the feature-specific pipeline models.
 */

export type TimelineSegmentKind = "at-dock" | "at-sea";
export type TimelineMarkerAppearance = "past" | "future";
export type TimelineEventType = "arrive" | "depart";

export type TimelineTimePoint = {
  scheduled?: Date;
  actual?: Date;
  estimated?: Date;
};

export type TimelineRenderBoundary = {
  eventType: TimelineEventType;
  currTerminalAbbrev?: string;
  currTerminalDisplayName?: string;
  nextTerminalAbbrev?: string;
  timePoint: TimelineTimePoint;
};

export type TimelineRenderRow = {
  id: string;
  kind: TimelineSegmentKind;
  markerAppearance: TimelineMarkerAppearance;
  segmentIndex: number;
  geometryMinutes: number;
  startBoundary: TimelineRenderBoundary;
  endBoundary?: TimelineRenderBoundary;
  isFinalRow: boolean;
};

export type TimelineActiveIndicator = {
  rowId: string;
  rowIndex: number;
  positionPercent: number;
  label: string;
  title?: string;
  subtitle?: string;
  animate?: boolean;
  speedKnots?: number;
};

export type RowLayoutBounds = {
  y: number;
  height: number;
};

/**
 * Pre-computed geometry for a terminal card background.
 * Used by TimelineTerminalCardBackgrounds for "at terminal" highlight regions.
 */
export type TerminalCardGeometry = {
  id: string;
  position: "top" | "bottom" | "single";
  topPx: number;
  heightPx: number;
};
