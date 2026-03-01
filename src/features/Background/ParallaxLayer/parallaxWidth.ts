// ============================================================================
// Parallax Distance Utility
// ============================================================================
// Deterministic width calculation for parallax background layers. At max scroll
// right, a layer translates left by D = (scrollableRange/itemStride) * (M/100) * MAX_PARALLAX_PX.
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
 * @param scrollableRange - Total pixels the carousel can scroll
 * @param parallaxMultiplier - 0–100 layer strength (closer = higher)
 * @param itemStride - One scroll step in pixels (itemSize + spacing)
 * @param maxParallaxPx - Base pixels from getMaxParallaxPx (orientation-aware)
 * @returns Parallax distance in pixels for use in ParallaxLayer
 */
export const computeParallaxDistance = (
  scrollableRange: number,
  parallaxMultiplier: number,
  itemStride: number,
  maxParallaxPx: number
): number => {
  const numScrollableIntervals = scrollableRange / itemStride;
  return numScrollableIntervals * (parallaxMultiplier / 100) * maxParallaxPx;
};

/**
 * Required width for a parallax layer so it never shows empty space when
 * scrolled right, given screen width, scrollable range, and parallax multiplier.
 *
 * @param screenWidth - Viewport width (visible screen width) for layer coverage
 * @param scrollableRange - Total pixels the carousel can scroll
 * @param parallaxMultiplier - 0–100 (e.g. SKY_PARALLAX_MULTIPLIER or PARALLAX_WAVES_MAX)
 * @param itemStride - One scroll step in pixels (itemSize + spacing)
 * @param maxParallaxPx - Effective max from getMaxParallaxPx (orientation-aware)
 * @returns Minimum width in pixels for the layer to cover the viewport at max scroll
 */
export const computeLayerContainerWidth = (
  screenWidth: number,
  scrollableRange: number,
  parallaxMultiplier: number,
  itemStride: number,
  maxParallaxPx = MAX_PARALLAX_PX
): number => {
  const parallaxDistance = computeParallaxDistance(
    scrollableRange,
    parallaxMultiplier,
    itemStride,
    maxParallaxPx
  );
  return screenWidth + parallaxDistance;
};
