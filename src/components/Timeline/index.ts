/**
 * Public exports for timeline UI primitives.
 *
 * Core components:
 * - VerticalTimeline: vertical timeline with row layout (left/center/right slots)
 * - TimelineTrack: track segment backbone and static marker (used internally)
 * - TimelineProgressIndicator: inline moving indicator (used internally)
 * - TimelineDot: reusable circular dot for markers and indicators
 *
 * Types and utilities:
 * - TimelineRow: model for timeline segments with duration and progress
 * - TimelineTheme: styling configuration with optional overrides
 * - TimelineDocument: generic ordered-document shape for timeline features
 * - Timeline selectors: active-row, row-phase, and percent-complete helpers
 */

export type {
  TimelineActiveIndicator,
  TimelineDocument,
  TimelineDocumentRow,
  TimelineLayoutMode,
  TimelineLifecyclePhase,
  TimelineRenderRow,
  TimelineRenderState,
} from "./TimelineDocument";
export {
  getActiveTimelineRow,
  getTimelineRowPercentComplete,
  getTimelineRowPhase,
} from "./TimelineDocument";
export { TimelineMarker as TimelineDot } from "./TimelineMarker";
export { TimelineProgressIndicator } from "./TimelineProgressIndicator";
export { TimelineRow as TimelineRowComponent } from "./TimelineRow";
export { TimelineTrack } from "./TimelineTrack";
export type {
  TimelineOrientation,
  TimelineRow,
  TimelineTheme,
} from "./TimelineTypes";
export { DEFAULT_TIMELINE_THEME } from "./TimelineTypes";
export { VerticalTimeline } from "./VerticalTimeline";
