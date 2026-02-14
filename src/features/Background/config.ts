// ============================================================================
// Background Parallax Config
// ============================================================================
// Parallax strength and layer multipliers (0–100). Used when scrollX/slotWidth
// drive horizontal translateX: closer layers use higher multipliers.
// ============================================================================

/** Max parallax movement in pixels per card for the strongest layer (multiplier 100). */
export const MAX_PARALLAX_PX = 50;

/**
 * Effective max parallax from screen orientation. Doubles in landscape so the
 * effect is more pronounced on wide screens. Call with isLandscape from
 * useIsLandscape (uses native orientation API for reliable iPad detection).
 *
 * @param isLandscape - true when screen is in landscape (from useIsLandscape)
 * @returns MAX_PARALLAX_PX in portrait, MAX_PARALLAX_PX * 2 in landscape
 */
export const getMaxParallaxPx = (isLandscape: boolean): number =>
  isLandscape ? MAX_PARALLAX_PX * 2 : MAX_PARALLAX_PX;

/** Sky layer parallax multiplier (0–100). Farthest layer, moves least. */
export const SKY_PARALLAX_MULTIPLIER = 8;

// ----------------------------------------------------------------------------
// Wave layer parallax ranges (0–100)
// ----------------------------------------------------------------------------
// Each wave gets its own multiplier by lerping within the range (back = min, front = max).

/** Background grass waves: min = farthest, max = closest to ocean. */
export const PARALLAX_BG_GRASS = { min: 10, max: 30 } as const;

/** Ocean waves: min = back, max = front. */
export const PARALLAX_OCEAN = { min: 20, max: 60 } as const;

/** Foreground grass waves: min = back, max = front (closest to viewer). */
export const PARALLAX_FG_GRASS = { min: 80, max: 100 } as const;

/** Worst-case parallax multiplier for the waves container (max of all wave layers). */
export const PARALLAX_WAVES_MAX = Math.max(
  PARALLAX_BG_GRASS.max,
  PARALLAX_OCEAN.max,
  PARALLAX_FG_GRASS.max
);
