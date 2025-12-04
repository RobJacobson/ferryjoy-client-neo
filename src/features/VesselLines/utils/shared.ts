/**
 * Utility functions for vessel line components
 */

// Line cap and join styles
export const LINE_CAP = "round";
export const LINE_JOIN = "round";

// Colors
export const LINE_START_COLOR = "rgba(236, 72, 153, 0.75)";
export const LINE_END_COLOR = "rgba(236, 72, 153, 0)";

/**
 * Creates a line gradient with specified RGBA color
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @param a - Alpha component (0-1)
 * @returns Gradient array with specified RGBA color at start and RGB with alpha=0 at end
 */
export const createLineGradient = (
  r: number,
  g: number,
  b: number,
  a: number
  // biome-ignore lint/suspicious/noExplicitAny: Cross-platform compatibility
): any => [
  "interpolate",
  ["linear"],
  ["line-progress"],
  0,
  `rgba(${r}, ${g}, ${b}, ${a})`,
  1,
  `rgba(${r}, ${g}, ${b}, 0})`,
];

// Default gradient using original color (236, 72, 153) with 0.75 alpha
// biome-ignore lint/suspicious/noExplicitAny: Cross-platform compatibility
export const LINE_GRADIENT: any = createLineGradient(236, 72, 153, 0.75);
