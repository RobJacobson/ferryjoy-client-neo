/**
 * Public exports for timeline UI primitives.
 *
 * Core components:
 * - TimelineDot: circular dot for static segment markers (alias of TimelineMarker)
 * - TimelineRowComponent: row layout with left/center/right slots
 *
 * Types and utilities:
 * - TimelineRow: model for timeline segments with duration and progress
 * - TimelineTheme: styling configuration with optional overrides
 * - TimelineDocument: generic ordered-document shape for timeline features
 * - Timeline selectors: active-row and row-phase helpers
 */

export type {
  TimelineActiveIndicator,
  TimelineDocument,
  TimelineDocumentRow,
  TimelineLifecyclePhase,
  TimelineRenderRow,
  TimelineRenderState,
} from "../../features/VesselTripTimeline/utils/types";
export { TimelineMarker as TimelineDot } from "./TimelineMarker";
export { TimelineRow as TimelineRowComponent } from "./TimelineRow";
export type {
  TimelineOrientation,
  TimelineRow,
  TimelineTheme,
} from "./TimelineTypes";
export { DEFAULT_TIMELINE_THEME } from "./TimelineTypes";
