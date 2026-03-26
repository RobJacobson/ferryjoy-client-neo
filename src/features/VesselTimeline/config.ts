/**
 * Feature-local render configuration for VesselTimeline.
 *
 * Keeps the timeline's sizing and layout knobs in one place so visual tuning
 * stays separate from the render-state pipeline logic.
 */

import type { VesselTimelineLayoutConfig } from "./types";

/**
 * Default pixel layout and nonlinear row-sizing config for VesselTimeline.
 *
 * `rowHeightBasePx` stays at `0` for now so the power-curve ratios remain
 * clean while `minRowHeightPx` still protects very short rows.
 */
export const DEFAULT_VESSEL_TIMELINE_LAYOUT: VesselTimelineLayoutConfig = {
  rowHeightBasePx: 0,
  rowHeightScalePx: 14,
  rowHeightExponent: 0.75,
  minRowHeightPx: 32,
  terminalCardTopHeightPx: 16,
  terminalCardBottomHeightPx: 16,
  initialAutoScroll: "center-active-indicator",
  initialScrollAnchorPercent: 0.4,
};
