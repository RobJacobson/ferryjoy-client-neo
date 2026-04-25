/**
 * Shared types for the VesselTimeline feature.
 *
 * Describes the feature-owned row projection and the render-state boundary to
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
  terminalCardCapHeightPx: number;
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
  contentHeightPx: number;
  activeRowIndex: number;
  layout: VesselTimelineLayoutConfig;
  theme: TimelineVisualTheme;
  activeIndicator: TimelineActiveIndicator | null;
};
