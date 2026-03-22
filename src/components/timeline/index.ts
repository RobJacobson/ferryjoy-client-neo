/**
 * Public re-exports for shared vertical timeline presentation primitives.
 *
 * Features such as `VesselTimeline` and `VesselTripTimeline` build rows and
 * indicators upstream; these components render the shared visual contract.
 */

export {
  TIMELINE_INDICATOR_POSITION_INSET_PERCENT,
  TIMELINE_MARKER_COLUMN_WIDTH_PX,
  TIMELINE_MARKER_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "./config";
export { TimelineTerminalCardBackgrounds } from "./TimelineTerminalCardBackgrounds";
export { TimelineTrack } from "./TimelineTrack";
export {
  BASE_TIMELINE_VISUAL_THEME,
  createTimelineVisualTheme,
  TIMELINE_RENDER_CONSTANTS,
  type TimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "./theme";
export { TimelineIndicatorOverlay } from "./timelineIndicator";
export type { TimelineRowProps } from "./timelineRow";
export { TimelineRow, TimelineRowContent } from "./timelineRow";
export type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineActiveIndicator,
  TimelineEventType,
  TimelineMarkerAppearance,
  TimelineRenderEvent,
  TimelineRenderRow,
  TimelineSegmentKind,
  TimelineTimePoint,
} from "./types";
export {
  getBoundaryTopPx,
  getIndicatorTopPx,
  getTrackFractions,
} from "./viewState";
