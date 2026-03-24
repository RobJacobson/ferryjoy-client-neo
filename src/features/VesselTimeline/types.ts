/**
 * Shared types for the VesselTimeline feature.
 *
 * Describes the day-level pipeline from backend semantic timeline segments to
 * `VesselTimelineRenderState`. See `ARCHITECTURE.md` for stage boundaries and
 * data ownership.
 */

import type {
  RowLayoutBounds,
  TerminalCardGeometry,
  TimelineActiveIndicator,
  TimelineRenderRow,
  TimelineVisualTheme,
} from "@/components/timeline";

/**
 * Layout config for deterministic vessel timeline sizing.
 */
export type VesselTimelineLayoutConfig = {
  pixelsPerMinute: number;
  minRowHeightPx: number;
  terminalCardTopOffsetPx: number;
  terminalCardDepartureCapHeightPx: number;
  initialAutoScroll: "center-active-indicator" | "center-active-row" | "none";
  initialScrollAnchorPercent: number;
};

/**
 * Final render state consumed by the timeline UI.
 */
export type VesselTimelineRenderState = {
  rows: TimelineRenderRow[];
  rowLayouts: Record<string, RowLayoutBounds>;
  terminalCards: TerminalCardGeometry[];
  activeIndicator: TimelineActiveIndicator | null;
  contentHeightPx: number;
  layout: VesselTimelineLayoutConfig;
  theme: TimelineVisualTheme;
};
