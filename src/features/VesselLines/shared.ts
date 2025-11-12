/**
 * Utility functions for vessel line components
 */

/**
 * Get the source ID for a vessel line
 */
export const getSourceId = (id: string): string => `vessel-line-source-${id}`;

/**
 * Get the layer ID for a vessel line
 */
export const getLayerId = (id: string): string => `vessel-line-layer-${id}`;

/**
 * Shared constants for vessel line styling
 */

// Line dimensions
export const LINE_WIDTH = 16;
export const BASE_LINE_WIDTH = 6;

// Colors
export const LINE_START_COLOR = "rgba(236, 72, 153, 0.75)";
export const LINE_END_COLOR = "rgba(236, 72, 153, 0)";

// Line cap and join styles
export const LINE_CAP = "round";
export const LINE_JOIN = "round";

// Gradient configuration
// biome-ignore lint/suspicious/noExplicitAny: Cross-platform compatibility
export const LINE_GRADIENT: any = [
  "interpolate",
  ["linear"],
  ["line-progress"],
  0,
  LINE_START_COLOR,
  1,
  LINE_END_COLOR,
];
