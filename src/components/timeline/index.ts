/**
 * Public re-exports for shared vertical timeline presentation primitives.
 *
 * Features build semantic rows and indicators upstream (see
 * `VesselTimeline/docs/ARCHITECTURE.md`); this package renders the shared visual
 * contract only.
 */

export {
  TIMELINE_CARD_CONFIG,
  TIMELINE_INDICATOR_CONFIG,
  TIMELINE_ROW_CONFIG,
  TIMELINE_SHARED_CONFIG,
} from "./config";
export { TimelineGlassSurface } from "./TimelineGlassSurface";
export { TimelineTerminalCardBackgrounds } from "./TimelineTerminalCardBackgrounds";
export { TimelineTrack } from "./TimelineTrack";
export {
  BASE_TIMELINE_VISUAL_THEME,
  CARNIVAL_FIZZ_TIMELINE_VISUAL_THEME,
  CONFETTI_TIDE_TIMELINE_VISUAL_THEME,
  createTimelineVisualTheme,
  HARBOR_DAWN_TIMELINE_VISUAL_THEME,
  MOON_JELLY_TIMELINE_VISUAL_THEME,
  PICNIC_POSTCARD_TIMELINE_VISUAL_THEME,
  SEA_GLASS_TIMELINE_VISUAL_THEME,
  TAFFY_HARBOR_TIMELINE_VISUAL_THEME,
  type TimelineVisualTheme,
  type TimelineVisualThemeOverrides,
} from "./theme";
export { TimelineIndicatorOverlay } from "./timelineIndicator";
export {
  TimelineRowContent,
  TimelineRowFixed,
  TimelineRowFlex,
} from "./timelineRow";
export type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineActiveIndicator,
  TimelineRenderEvent,
  TimelineRenderRow,
  TimelineTimePoint,
} from "./types";
export { useAnimatedProgress } from "./useAnimatedProgress";
export {
  getBoundaryTopPx,
  getTrackFractions,
} from "./viewState";
