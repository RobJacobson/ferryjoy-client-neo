// ============================================================================
// Parallax Width Utility
// ============================================================================
// Deterministic width calculation for parallax background layers. At max scroll
// right, a layer translates left by D = (numCards - 1) * (M/100) * MAX_PARALLAX_PX.
// The texture must extend past the viewport by at least D to avoid empty space.
// ============================================================================

import { MAX_PARALLAX_PX } from "./config";

/**
 * Required width for a parallax layer so it never shows empty space when
 * scrolled right, given screen width, number of cards, and parallax multiplier.
 *
 * @param screenWidth - Slot width from useCarouselLayout (matches viewport width)
 * @param numCards - Number of carousel cards
 * @param parallaxMultiplier - 0–100 (e.g. SKY_PARALLAX_MULTIPLIER or PARALLAX_WAVES_MAX)
 * @returns Minimum width in pixels for the layer to cover the viewport at max scroll
 */
export const computeRequiredBackgroundWidth = (
  screenWidth: number,
  numCards: number,
  parallaxMultiplier: number
): number =>
  screenWidth + (numCards - 1) * (parallaxMultiplier / 100) * MAX_PARALLAX_PX;
