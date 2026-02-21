// ============================================================================
// Parallax Width Utility
// ============================================================================
// Deterministic width calculation for parallax background layers. At max scroll
// right, a layer translates left by D = (numCards - 1) * (M/100) * MAX_PARALLAX_PX.
// The texture must extend past the viewport by at least D to avoid empty space.
// ============================================================================

import { MAX_PARALLAX_PX } from "./config";

// ============================================================================
// Functions
// ============================================================================

/**
 * Required width for a parallax layer so it never shows empty space when
 * scrolled right, given screen width, number of cards, and parallax multiplier.
 *
 * @param screenWidth - Viewport width (visible screen width) for layer coverage
 * @param numCards - Number of carousel cards
 * @param parallaxMultiplier - 0–100 (e.g. SKY_PARALLAX_MULTIPLIER or PARALLAX_WAVES_MAX)
 * @param maxParallaxPx - Effective max from getMaxParallaxPx(width, height)
 * @returns Minimum width in pixels for the layer to cover the viewport at max scroll
 */
export const computeRequiredBackgroundWidth = (
  screenWidth: number,
  numCards: number,
  parallaxMultiplier: number,
  maxParallaxPx = MAX_PARALLAX_PX
): number =>
  screenWidth + (numCards - 1) * (parallaxMultiplier / 100) * maxParallaxPx;
