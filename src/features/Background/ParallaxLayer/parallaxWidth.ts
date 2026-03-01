// ============================================================================
// Parallax Distance Utility
// ============================================================================
// Deterministic width calculation for parallax background layers. At max scroll
// right, a layer translates left by D = (numCards - 1) * (M/100) * MAX_PARALLAX_PX.
// The texture must extend past the viewport by at least D to avoid empty space.
//
// Coordinate system:
// - Layer starts at x=0 (left-aligned to viewport)
// - As scrollProgress goes 0→1, layer translates LEFT
// - translateX = -scrollProgress × parallaxDistance
// - Layer must extend right to cover: screenWidth + parallaxDistance
// ============================================================================

import { MAX_PARALLAX_PX } from "../config";

// ============================================================================
// Functions
// ============================================================================

/**
 * Parallax distance: how far a layer translates (in px) when scroll progress
 * goes from 0 to 1. Higher values = more movement = faster parallax.
 *
 * @param numCards - Number of carousel cards (e.g. TOTAL_CAROUSEL_ITEMS)
 * @param parallaxMultiplier - 0–100 layer strength (closer = higher)
 * @param maxParallaxPx - Base pixels from getMaxParallaxPxSafe (orientation-aware)
 * @returns Parallax distance in pixels for use in ParallaxLayer
 */
export const computeParallaxDistance = (
  numCards: number,
  parallaxMultiplier: number,
  maxParallaxPx: number
): number => (numCards - 1) * (parallaxMultiplier / 100) * maxParallaxPx;

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
export const computeLayerContainerWidth = (
  screenWidth: number,
  numCards: number,
  parallaxMultiplier: number,
  maxParallaxPx = MAX_PARALLAX_PX
): number =>
  screenWidth + (numCards - 1) * (parallaxMultiplier / 100) * maxParallaxPx;
