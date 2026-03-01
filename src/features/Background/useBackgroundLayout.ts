// ============================================================================
// useBackgroundLayout Hook
// ============================================================================
// Calculates layout dimensions for a single parallax background layer.
// Computes parallax distance and layer container width based on
// screen dimensions, orientation, and parallax multiplier.
//
// Coordinate system:
// - Layer starts at x=0 (left-aligned to viewport)
// - As scrollProgress goes 0→1, layer translates LEFT
// - translateX = -scrollProgress × parallaxDistance
// - Layer must extend right to cover: screenWidth + parallaxDistance
// ============================================================================

import { useWindowDimensions } from "react-native";
import { useIsLandscape } from "@/shared/hooks/useIsLandscape";
import { getMaxParallaxPx } from "./config";
import {
  computeLayerContainerWidth,
  computeParallaxDistance,
} from "./ParallaxLayer/parallaxWidth";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for useBackgroundLayout hook.
 */
interface UseBackgroundLayoutProps {
  /**
   * Parallax multiplier (0-100) for this background layer.
   */
  parallaxMultiplier: number;
  /**
   * Total pixels the carousel can scroll.
   */
  scrollableRange: number;
  /**
   * One scroll step in pixels (itemSize + spacing).
   */
  itemStride: number;
}

/**
 * Configuration for a single parallax layer's layout.
 */
interface LayerLayout {
  /**
   * How far this layer translates when scrollProgress = 1 (in pixels).
   * Use this value for the ParallaxLayer's parallaxDistance prop.
   */
  parallaxDistance: number;

  /**
   * Required width for the layer container to prevent empty space at edges.
   * Use this for the width style of the layer container.
   */
  layerContainerWidth: number;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Computes layout dimensions for a single parallax background layer.
 * Returns parallax distance and required container width based on:
 * - Screen dimensions (from useWindowDimensions)
 * - Screen orientation (from useIsLandscape)
 * - Parallax multiplier (passed as prop)
 * - Scrollable range and item stride (from carousel)
 *
 * For multiple layers with different depths, use the pure functions
 * computeParallaxDistance and computeLayerContainerWidth directly.
 *
 * @param parallaxMultiplier - Parallax strength (0-100) for this layer
 * @param scrollableRange - Total pixels the carousel can scroll
 * @param itemStride - One scroll step in pixels (itemSize + spacing)
 * @returns Object containing parallaxDistance and layerContainerWidth
 *
 * @example
 * ```tsx
 * const { parallaxDistance, layerContainerWidth } = useBackgroundLayout({
 *   parallaxMultiplier: SKY_PARALLAX_MULTIPLIER,
 *   scrollableRange: carouselRef.current.scrollableRange,
 *   itemStride: carouselRef.current.itemStride,
 * });
 * ```
 */
export const useBackgroundLayout = ({
  parallaxMultiplier,
  scrollableRange,
  itemStride,
}: UseBackgroundLayoutProps): LayerLayout => {
  const isLandscape = useIsLandscape();
  const { width: screenWidth } = useWindowDimensions();
  const maxParallaxPx = getMaxParallaxPx(isLandscape);

  const parallaxDistance = computeParallaxDistance(
    scrollableRange,
    parallaxMultiplier,
    itemStride,
    maxParallaxPx
  );

  const layerContainerWidth = computeLayerContainerWidth(
    screenWidth,
    scrollableRange,
    parallaxMultiplier,
    itemStride,
    maxParallaxPx
  );

  return {
    parallaxDistance,
    layerContainerWidth,
  };
};
