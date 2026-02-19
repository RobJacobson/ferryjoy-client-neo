// ============================================================================
// useBackgroundLayout Hook
// ============================================================================
// Shared layout calculation logic for parallax background layers.
// Computes max parallax pixels and required background width based on
// screen dimensions, orientation, and parallax multiplier.
// ============================================================================

import { useWindowDimensions } from "react-native";
import { NUM_TERMINAL_CARDS } from "@/data/terminalConnections";
import { useIsLandscape } from "@/shared/hooks/useIsLandscape";
import { getMaxParallaxPxSafe } from "./config";
import { computeRequiredBackgroundWidth } from "./parallaxWidth";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for useBackgroundLayout hook.
 */
export interface UseBackgroundLayoutProps {
  /**
   * Parallax multiplier (0-100) for this background layer.
   * Higher values create more movement. Sky uses lower values,
   * Waves uses higher values.
   */
  parallaxMultiplier: number;
}

/**
 * Return value from useBackgroundLayout hook.
 */
export interface UseBackgroundLayoutResult {
  /**
   * Maximum parallax movement in pixels.
   * Computed from screen orientation (doubled in landscape).
   */
  maxParallaxPx: number;

  /**
   * Required width for the background layer.
   * Ensures layer extends past viewport to avoid empty space at max scroll.
   */
  requiredWidth: number;

  /**
   * Computes required width for any parallax multiplier (0–100) using the
   * current screen dimensions and maxParallaxPx.
   *
   * @param parallaxMultiplier - Parallax strength (0-100) for a layer
   * @returns Minimum width in pixels for the layer to cover the viewport at max scroll
   */
  getRequiredWidth: (parallaxMultiplier: number) => number;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Computes shared layout values for parallax background layers.
 * Returns maximum parallax pixels and required background width based on:
 * - Screen dimensions (from useWindowDimensions)
 * - Screen orientation (from useIsLandscape)
 * - Parallax multiplier (passed as prop)
 *
 * @param parallaxMultiplier - Parallax strength (0-100) for this layer
 * @returns Object containing maxParallaxPx and requiredWidth for layout calculations
 *
 * @example
 * ```tsx
 * const { maxParallaxPx, requiredWidth } = useBackgroundLayout({
 *   parallaxMultiplier: SKY_PARALLAX_MULTIPLIER,
 * });
 *
 * // Use maxParallaxPx in useParallaxScroll
 * // Use requiredWidth for background container width
 * ```
 */
export const useBackgroundLayout = ({
  parallaxMultiplier,
}: UseBackgroundLayoutProps): UseBackgroundLayoutResult => {
  const isLandscape = useIsLandscape();
  const { width, height } = useWindowDimensions();
  const maxParallaxPx = getMaxParallaxPxSafe(isLandscape, width, height);
  const getRequiredWidth = (layerParallaxMultiplier: number): number =>
    computeRequiredBackgroundWidth(
      width,
      NUM_TERMINAL_CARDS,
      layerParallaxMultiplier,
      maxParallaxPx
    );

  const requiredWidth = getRequiredWidth(parallaxMultiplier);

  return { maxParallaxPx, requiredWidth, getRequiredWidth };
};
