// ============================================================================
// Sky Feature Config
// ============================================================================
// Single source of truth for gradient, sunburst, sun, and paper texture.
// Colors use Tailwind palette. Index for pink: 0=50, 1=100, 2=200, 3=300, 4=400, 5=500.
// ============================================================================

/**
 * Configuration constants for the Sky feature including gradient colors,
 * sunburst layout/rotation, sun disc styling, and paper texture opacity.
 */

import { createColorGenerator } from "@/shared/utils";

/** Color generator for pink. lightness 0–1000. */
const fuscia = createColorGenerator("ff22ee");

/** Tailwind orange for sun fill. */
const orange = {
  300: "#F6E473",
} as const;

/** Sky gradient and paper overlay. */
const gradient = {
  start: fuscia(100),
  end: fuscia(300),
} as const;

/** Sunburst layout, rotation, and radial gradient. */
const sunburst = {
  viewBoxSize: 1000,
  defaultSize: 2000,
  rayCount: 12,
  centerX: 25,
  centerY: 20,
  spiralStrength: -0.5,
  rotationDurationMs: 180_000,
  preserveAspectRatio: "xMidYMid slice" as const,
  startColor: fuscia(100),
  endColor: fuscia(400),
} as const;

/** Sun disc: layout, shadow, stroke, and ray path geometry. */
const sun = {
  innerRadiusPx: 40,
  outerRadiusPx: 50,
  sizePx: 140,
  viewBoxSize: 1000,
  shadowOpacity: 0.04,
  shadowLayers: [
    [-3, 3],
    [-2, 2],
    [-1, 1],
  ] as [number, number][],
  stroke: {
    color: "black",
    width: 0.5,
    opacity: 0.15,
  },
  rayGeometry: {
    baseWidthFraction: 1,
    tipWidthFraction: 0.2,
    outerBulgeFraction: 0.2,
  },
  color: orange[300],
} as const;

/** Paper texture opacity for Sky and Sunburst (aligns with Waves). */
const paperTextureOpacity = 0.25;

const config = {
  gradient,
  sunburst,
  sun,
  paperTextureOpacity,
};

export default config;
