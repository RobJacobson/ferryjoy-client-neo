/**
 * Public re-exports for shared vertical timeline presentation primitives.
 *
 * Features build semantic rows and indicators upstream (see
 * `VesselTimeline/ARCHITECTURE.md`); this package renders the shared visual
 * contract only.
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
  HARBOR_DAWN_TIMELINE_VISUAL_THEME,
  SEA_GLASS_TIMELINE_VISUAL_THEME,
  SIGNAL_NIGHT_TIMELINE_VISUAL_THEME,
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
