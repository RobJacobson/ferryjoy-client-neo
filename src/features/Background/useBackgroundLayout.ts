// ============================================================================
// useBackgroundLayout Hook
// ============================================================================
// Calculates layout dimensions for parallax background layers.
// Computes max parallax distance and layer container width based on
// screen dimensions, orientation, and parallax multiplier.
//
// Coordinate system:
// - Layer starts at x=0 (left-aligned to viewport)
// - As scrollProgress goes 0→1, layer translates LEFT
// - translateX = -scrollProgress × parallaxDistance
// - Layer must extend right to cover: screenWidth + parallaxDistance
// ============================================================================

import { useWindowDimensions } from "react-native";
import { TOTAL_CAROUSEL_ITEMS } from "@/data/terminalConnections";
import { useIsLandscape } from "@/shared/hooks/useIsLandscape";
import { getMaxParallaxPxSafe } from "./config";
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
   * Used to compute layout for this specific layer. The returned functions
   * can compute values for other multipliers as needed.
   */
  parallaxMultiplier: number;
}

/**
 * Configuration for a parallax layer's layout.
 */
interface ParallaxLayerConfig {
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

  /**
   * Computes parallax distance for any multiplier (0–100).
   *
   * @param multiplier - Parallax strength (0-100) for a layer
   * @returns Parallax distance in pixels
   */
  computeParallaxDistance: (multiplier: number) => number;

  /**
   * Computes layer container width for any multiplier (0–100).
   *
   * @param multiplier - Parallax strength (0-100) for a layer
   * @returns Layer container width in pixels
   */
  computeLayerContainerWidth: (multiplier: number) => number;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Computes layout dimensions for a parallax background layer.
 * Returns parallax distance and required container width based on:
 * - Screen dimensions (from useWindowDimensions)
 * - Screen orientation (from useIsLandscape)
 * - Parallax multiplier (passed as prop)
 *
 * Also provides functions to compute values for any parallax multiplier,
 * useful when rendering multiple layers with different depths (e.g., waves).
 *
 * @param parallaxMultiplier - Parallax strength (0-100) for this layer
 * @returns Object containing parallaxDistance, layerContainerWidth, and computation functions
 *
 * @example
 * ```tsx
 * // Single layer (Sky)
 * const { parallaxDistance, layerContainerWidth } = useBackgroundLayout({
 *   parallaxMultiplier: SKY_PARALLAX_MULTIPLIER,
 * });
 *
 * // Multiple layers (Waves)
 * const { computeParallaxDistance, computeLayerContainerWidth } = useBackgroundLayout({
 *   parallaxMultiplier: PARALLAX_WAVES_MAX,
 * });
 * const skyConfig = { distance: computeParallaxDistance(8), width: computeLayerContainerWidth(8) };
 * const oceanConfig = { distance: computeParallaxDistance(40), width: computeLayerContainerWidth(40) };
 * ```
 */
export const useBackgroundLayout = ({
  parallaxMultiplier,
}: UseBackgroundLayoutProps): ParallaxLayerConfig => {
  const isLandscape = useIsLandscape();
  const { width: screenWidth, height } = useWindowDimensions();
  const maxParallaxPx = getMaxParallaxPxSafe(isLandscape, screenWidth, height);

  const parallaxDistance = computeParallaxDistance(
    TOTAL_CAROUSEL_ITEMS,
    parallaxMultiplier,
    maxParallaxPx
  );

  const layerContainerWidth = computeLayerContainerWidth(
    screenWidth,
    TOTAL_CAROUSEL_ITEMS,
    parallaxMultiplier,
    maxParallaxPx
  );

  const computeParallaxDistanceForMultiplier = (multiplier: number): number =>
    computeParallaxDistance(TOTAL_CAROUSEL_ITEMS, multiplier, maxParallaxPx);

  const computeLayerContainerWidthForMultiplier = (
    multiplier: number
  ): number =>
    computeLayerContainerWidth(
      screenWidth,
      TOTAL_CAROUSEL_ITEMS,
      multiplier,
      maxParallaxPx
    );

  return {
    parallaxDistance,
    layerContainerWidth,
    computeParallaxDistance: computeParallaxDistanceForMultiplier,
    computeLayerContainerWidth: computeLayerContainerWidthForMultiplier,
  };
};
