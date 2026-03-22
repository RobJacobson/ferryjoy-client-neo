/**
 * Shared rendering contract for vertical timeline UI.
 *
 * Describes row content, markers, and the active indicator as consumed by
 * `src/components/timeline`. Feature pipelines map domain data into these
 * shapes; this module stays presentation-only.
 */

export type TimelineSegmentKind = "at-dock" | "at-sea";
export type TimelineMarkerAppearance = "past" | "future";
export type TimelineEventType = "arrive" | "depart";

export type TimelineTimePoint = {
  scheduled?: Date;
  actual?: Date;
  estimated?: Date;
};

export type TimelineRenderEvent = {
  eventType: TimelineEventType;
  currTerminalAbbrev?: string;
  currTerminalDisplayName?: string;
  nextTerminalAbbrev?: string;
  isArrivalPlaceholder?: boolean;
  timePoint: TimelineTimePoint;
};

export type TimelineRenderRow = {
  id: string;
  kind: TimelineSegmentKind;
  markerAppearance: TimelineMarkerAppearance;
  segmentIndex: number;
  displayHeightPx: number;
  startEvent: TimelineRenderEvent;
  endEvent?: TimelineRenderEvent;
  isFinalRow: boolean;
};

export type TimelineActiveIndicator = {
  rowId: string;
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
 * Pre-computed layout for a blurred terminal highlight behind timeline rows.
 */
export type TerminalCardGeometry = {
  id: string;
  position: "top" | "bottom" | "single";
  topPx: number;
  heightPx: number;
};
