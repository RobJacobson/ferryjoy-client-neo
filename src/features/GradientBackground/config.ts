/**
 * Tunable defaults for gradient background palette, orb layout, radial stops,
 * and noise overlay.
 */

type GradientOrbGradientStop = {
  position: number;
  alpha: number;
};

/**
 * Single source of feature constants for gradient background visuals.
 */
export const gradientBackgroundConfig = {
  defaultColors: ["#6FA8FF", "#FF8E72", "#7BE0C3", "#8D7DFF"] as const,
  orb: {
    radiusRange: {
      min: 0.3,
      max: 0.6,
    },
    durationRangeMs: {
      min: 20000,
      max: 60000,
    },
    // Sorted by `position`; keep alpha decreasing toward the edge or the radial
    // fill reads as concentric “rings” (one SVG circle, not stacked layers).
    gradientStops: [
      { position: 0, alpha: 0.95 },
      { position: 0.25, alpha: 0.9 },
      { position: 0.5, alpha: 0.4 },
      { position: 0.75, alpha: 0.1 },
      { position: 1, alpha: 0 },
    ] as const satisfies readonly GradientOrbGradientStop[],
  },
  noise: {
    enabled: true,
    opacity: 0.2,
    scale: 1,
    offsetXPx: 0,
    offsetYPx: 0,
    textureSizePx: 512,
    textureSource: require("../../../assets/textures/gradient-background-noise.png"),
  },
} as const;
