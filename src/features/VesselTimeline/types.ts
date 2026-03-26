/**
 * Shared types for the VesselTimeline feature.
 *
 * Describes the day-level render-state flow from backend semantic timeline
 * segments to `VesselTimelineRenderState`. See `docs/ARCHITECTURE.md` for
 * stage boundaries and data ownership.
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
  rowHeightBasePx: number;
  rowHeightScalePx: number;
  rowHeightExponent: number;
  minRowHeightPx: number;
  terminalCardTopHeightPx: number;
  terminalCardBottomHeightPx: number;
  initialAutoScroll: "center-active-indicator" | "center-active-row" | "none";
  initialScrollAnchorPercent: number;
};

/**
 * Static render state consumed by the timeline UI.
 */
export type VesselTimelineStaticRenderState = {
  rows: TimelineRenderRow[];
  rowLayouts: Record<string, RowLayoutBounds>;
  terminalCards: TerminalCardGeometry[];
  contentHeightPx: number;
  activeSegmentIndex: number;
  layout: VesselTimelineLayoutConfig;
  theme: TimelineVisualTheme;
};

/**
 * Final render state consumed by the timeline UI.
 */
export type VesselTimelineRenderState = VesselTimelineStaticRenderState & {
  activeIndicator: TimelineActiveIndicator | null;
};
