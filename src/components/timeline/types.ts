/**
 * Shared UI types for vertical timeline renderer components.
 *
 * These types intentionally capture only the rendering contract required by
 * the shared timeline components, not the feature-specific pipeline models.
 */

export type TimelineSegmentKind = "at-dock" | "at-sea";

export type TimelineTimePoint = {
  scheduled?: Date;
  actual?: Date;
  estimated?: Date;
};

export type TimelineRenderBoundary = {
  label: string;
  terminalAbbrev?: string;
  timePoint: TimelineTimePoint;
};

export type TimelineRenderRow = {
  id: string;
  kind: TimelineSegmentKind;
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
};

export type RowLayoutBounds = {
  y: number;
  height: number;
};
