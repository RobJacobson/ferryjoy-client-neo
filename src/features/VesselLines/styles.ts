/**
 * Shared constants for vessel line styling
 */

// Line dimensions
export const LINE_WIDTH = 6;
export const SHADOW_WIDTH = 12;
export const SHADOW_BLUR = 4;

// Colors
export const SHADOW_COLOR = "rgba(0, 0, 0, 0.3)";
export const LINE_START_COLOR = "rgba(236, 72, 153, 1)";
export const LINE_END_COLOR = "rgba(236, 72, 153, 0)";

// Line cap and join styles
export const LINE_CAP = "round";
export const LINE_JOIN = "round";

// Gradient configuration
export const LINE_GRADIENT: any = [
  "interpolate",
  ["linear"],
  ["line-progress"],
  0,
  LINE_START_COLOR,
  1,
  LINE_END_COLOR,
];
