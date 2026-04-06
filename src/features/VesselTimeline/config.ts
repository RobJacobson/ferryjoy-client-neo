/**
 * Feature-local render configuration for VesselTimeline.
 *
 * Keeps the timeline's sizing and layout knobs in one place so visual tuning
 * stays separate from the render-pipeline logic.
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
  rowHeightScalePx: 10,
  rowHeightExponent: 0.85,
  minRowHeightPx: 32,
  terminalCardTopHeightPx: 16,
  terminalCardBottomHeightPx: 16,
  initialAutoScroll: "center-active-indicator",
  initialScrollAnchorPercent: 0.4,
};

/**
 * Maximum visual duration for the compressed overnight dock row at day start.
 */
export const START_OF_DAY_DOCK_VISUAL_CAP_MINUTES = 60;
