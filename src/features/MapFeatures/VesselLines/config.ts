import type { SmoothingStrategyName } from "./utils/smoothing";

/**
 * Centralized configuration for the VesselLines feature
 */
export const VESSEL_LINE_CONFIG = {
  // Smoothing configuration
  smoothing: {
    // Default smoothing strategy
    // strategy: "d3Basis" as SmoothingStrategyName,
    strategy: "none" as SmoothingStrategyName,
    // Bezier curve parameters
    bezierResolution: 500,
    bezierSharpness: 0.5,
    // Cardinal curve tension
    cardinalTension: 0.25,
  },

  // Filtering configuration
  filtering: {
    // Time window in milliseconds for filtering recent pings
    timeWindowMs: 15000,
    // Minimum number of points required to draw a line
    minPoints: 2,
  },

  // Styling configuration
  styling: {
    // Line width configuration for dual-layer rendering
    innerLineWidth: 12,
    outerLineWidth: 14,
    baseLineWidth: 0,
    // Colors
    colors: {
      // Pink-400 with opacity for vessels in service
      inService: [244, 114, 182, 0.4] as [number, number, number, number],
      // White with opacity for vessels at dock
      atDock: [255, 255, 255, 0.2] as [number, number, number, number],
    },
  },
} as const;
