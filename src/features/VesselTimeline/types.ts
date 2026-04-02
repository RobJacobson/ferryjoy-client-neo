/**
 * Shared types for the VesselTimeline feature.
 *
 * Describes the render-state boundary between backend-owned timeline rows and
 * the presentation-only `src/components/timeline` renderer.
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
  activeRowIndex: number;
  layout: VesselTimelineLayoutConfig;
  theme: TimelineVisualTheme;
};

/**
 * Final render state consumed by the timeline UI.
 */
export type VesselTimelineRenderState = VesselTimelineStaticRenderState & {
  activeIndicator: TimelineActiveIndicator | null;
};
