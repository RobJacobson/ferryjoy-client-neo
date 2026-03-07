/**
 * Public exports for timeline UI primitives.
 *
 * Core components:
 * - VerticalTimeline: vertical timeline with row layout (left/center/right slots)
 * - HorizontalTimeline: horizontal timeline with column layout (top/bottom slots)
 * - TimelineTrack: track segment with marker and indicator (used internally)
 * - TimelineDot: reusable circular dot for markers and indicators
 *
 * Overlay system:
 * - VerticalTimelineIndicatorOverlay: absolute indicator for use with background mode
 * - useVerticalTimelineOverlayPlacement: hook for measuring and positioning overlays
 *
 * Types and utilities:
 * - TimelineRow: model for timeline segments with time range and progress
 * - TimelineTheme: styling configuration with optional overrides
 * - timelineMath functions: validation and math helpers for timeline data
 */

export { HorizontalTimeline } from "./HorizontalTimeline";
export { TimelineMarker as TimelineDot } from "./TimelineMarker";
export type {
  TimelineRowBounds,
  VerticalTimelineRenderMode,
} from "./TimelineRow";
export { TimelineRowComponent } from "./TimelineRow";
export { TimelineTrack } from "./TimelineTrack";
export type {
  TimelineOrientation,
  TimelineRow,
  TimelineTheme,
} from "./TimelineTypes";
export { DEFAULT_TIMELINE_THEME } from "./TimelineTypes";
export {
  getDurationMinutes,
  getValidatedPercentComplete,
  shouldShowMovingIndicator,
} from "./timelineMath";
export { useVerticalTimelineOverlayPlacement } from "./useVerticalTimelineOverlayPlacement";
export { VerticalTimeline } from "./VerticalTimeline";
export { VerticalTimelineIndicatorOverlay } from "./VerticalTimelineIndicatorOverlay";
