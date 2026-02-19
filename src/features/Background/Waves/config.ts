// ============================================================================
// Waves Feature Config
// ============================================================================
// Single source of truth for SVG dimensions, stroke/shadow/paper, container
// layout, ocean wave lerp ranges, and grass layer definitions.
// ============================================================================

/** Width of the wave SVG canvas. Wider width allows oscillation without visible edges. */
export const SVG_WIDTH = 2000;

/** Height of the wave SVG canvas. */
export const SVG_HEIGHT = 500;

// ----------------------------------------------------------------------------
// AnimatedWave styling
// ----------------------------------------------------------------------------

/** Stroke applied to wave path (color, width, opacity). */
export const WAVE_STROKE = {
  color: "black",
  width: 0.5,
  opacity: 0.1,
} as const;

/** Opacity of the paper texture overlay on waves. */
export const PAPER_TEXTURE_OPACITY = 0.25;

/** Pseudo-drop shadow opacity for layered black copies of the wave. */
export const SHADOW_OPACITY = 0.02;

/** Pseudo-drop shadow [dx, dy] offsets for each layer (creates depth). */
export const SHADOW_LAYERS: [number, number][] = [
  [9, -2],
  [6, -1],
  [3, -0.5],
];

// ----------------------------------------------------------------------------
// Ocean waves (lerped by layer index)
// ----------------------------------------------------------------------------

/** Ocean wave layer count and lerp ranges. First wave = min, last wave = max. */
export const OCEAN_WAVES = {
  count: 16,
  baseColor: "#28e",
  period: { min: 20, max: 400 },
  height: { min: 50, max: 12 },
  amplitude: { min: 2, max: 20 },
  animationDuration: { min: 40000, max: 120000 },
  maxXShiftPx: 800,
  lightness: { min: 150, max: 500 },
} as const;

// ----------------------------------------------------------------------------
// Grass layers (foreground and background)
// ----------------------------------------------------------------------------

/** Base color for grass (green). Used with createColorGenerator for lightness. */
export const GRASS_BASE_COLOR = "#5c5";

/**
 * Foreground grass layer config. Each layer is a static AnimatedWave.
 * lightness is passed to the grass color generator.
 */
export const FOREGROUND_LAYERS = [
  {
    amplitude: 5,
    period: 400,
    lightness: 450,
    height: 12,
    xOffsetPx: 0,
  },
  {
    amplitude: 10,
    period: 700,
    lightness: 400,
    height: 8,
    xOffsetPx: 20,
  },
] as const;

/**
 * Background grass layer config. Each layer is a static AnimatedWave.
 * Use fillColor for a fixed color (e.g. "#DEF") or lightness for grass shade.
 */
export const BACKGROUND_LAYERS: Array<{
  amplitude: number;
  period: number;
  height: number;
  xOffsetPx: number;
  fillColor?: string;
  lightness?: number;
}> = [
  {
    amplitude: 40,
    period: 100,
    fillColor: "#DEF",
    height: 55,
    xOffsetPx: 0,
  },
  {
    amplitude: 18,
    period: 275,
    lightness: 600,
    height: 58,
    xOffsetPx: 200,
  },
  {
    amplitude: 16,
    period: 250,
    lightness: 550,
    height: 57,
    xOffsetPx: 100,
  },
  {
    amplitude: 12,
    period: 225,
    lightness: 500,
    height: 56,
    xOffsetPx: 0,
  },
  {
    amplitude: 10,
    period: 200,
    lightness: 450,
    height: 55,
    xOffsetPx: 0,
  },
  {
    amplitude: 5,
    period: 150,
    lightness: 400,
    height: 52,
    xOffsetPx: 0,
  },
];
