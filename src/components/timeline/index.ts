/**
 * Public re-exports for shared vertical timeline presentation primitives.
 *
 * Features such as `VesselTimeline` and `VesselTripTimeline` build rows and
 * indicators upstream; these components render the shared visual contract.
 */

export {
  TIMELINE_MARKER_SIZE_PX,
  TIMELINE_TRACK_X_POSITION_PERCENT,
} from "./config";
export { TimelineTerminalCardBackgrounds } from "./TimelineTerminalCardBackgrounds";
export { TimelineTrack } from "./TimelineTrack";
export {
  BASE_TIMELINE_VISUAL_THEME,
  createTimelineVisualTheme,
  type TimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "./theme";
export { TimelineIndicatorOverlay } from "./timelineIndicator";
export { TimelineRow, TimelineRowContent } from "./timelineRow";
export type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineActiveIndicator,
  TimelineRenderEvent,
  TimelineRenderRow,
  TimelineTimePoint,
} from "./types";
export {
  getBoundaryTopPx,
  getTrackFractions,
} from "./viewState";
