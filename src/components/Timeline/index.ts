/**
 * Public exports for timeline UI primitives.
 *
 * Core components:
 * - VerticalTimeline: vertical timeline with row layout (left/center/right slots)
 * - TimelineTrack: track segment with marker and indicator (used internally)
 * - TimelineDot: reusable circular dot for markers and indicators
 *
 * Types and utilities:
 * - TimelineRow: model for timeline segments with time range and progress
 * - TimelineTheme: styling configuration with optional overrides
 * - timelineMath functions: validation and math helpers for timeline data
 */

export { TimelineMarker as TimelineDot } from "./TimelineMarker";
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
export { VerticalTimeline } from "./VerticalTimeline";
