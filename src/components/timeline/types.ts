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

/**
 * Event boundary times exposed to the shared presentation layer.
 */
export type TimelineTimePoint = {
  scheduled?: Date;
  actual?: Date;
  estimated?: Date;
};

/**
 * One boundary event rendered at the start or end of a timeline row.
 */
export type TimelineRenderEvent = {
  eventType: TimelineEventType;
  currTerminalAbbrev?: string;
  currTerminalDisplayName?: string;
  nextTerminalAbbrev?: string;
  isArrivalPlaceholder?: boolean;
  timePoint: TimelineTimePoint;
};

/**
 * Presentation-only row shape consumed by the shared vertical timeline UI.
 */
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

/**
 * Floating indicator copy and placement info for the overlay layer.
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
 * Cached row measurements used for indicator placement and progress math.
 */
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
