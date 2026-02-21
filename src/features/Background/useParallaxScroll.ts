// ============================================================================
// useParallaxScroll Hook
// ============================================================================
// Shared animation logic for scroll-driven parallax effects.
// Calculates horizontal translateX based on scroll progress (0-1) and
// parallax multiplier (0-100). Farther layers use lower multipliers.
// ============================================================================

import type { SharedValue } from "react-native-reanimated";
import { useAnimatedStyle } from "react-native-reanimated";
import { TOTAL_CAROUSEL_ITEMS } from "@/data/terminalConnections";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for useParallaxScroll hook.
 */
interface UseParallaxScrollProps {
  /**
   * Shared scroll progress (0 = first item, 1 = last item).
   */
  scrollProgress: SharedValue<number>;

  /**
   * Parallax multiplier (0-100). Higher values create more movement.
   * Farther layers use lower values (e.g., sky=8), closer layers use higher
   * values (e.g., foreground waves=100).
   */
  parallaxMultiplier: number;

  /**
   * Maximum parallax movement in pixels.
   * Computed from getMaxParallaxPxSafe() based on screen orientation.
   */
  maxParallaxPx: number;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Calculates scroll-driven parallax animation style for background layers.
 * Returns an animated style that applies horizontal translation based on scroll
 * progress, parallax multiplier, and maximum parallax pixels. The layer
 * translates left when scrolling right, creating a depth effect.
 *
 * @param scrollProgress - Shared scroll progress (0-1)
 * @param parallaxMultiplier - Parallax strength (0-100)
 * @param maxParallaxPx - Maximum parallax movement in pixels
 * @returns Animated style object with translateX transform
 */
export const useParallaxScroll = ({
  scrollProgress,
  parallaxMultiplier,
  maxParallaxPx,
}: UseParallaxScrollProps) =>
  useAnimatedStyle(() => {
    const maxSlots = TOTAL_CAROUSEL_ITEMS - 1;
    const translateX =
      -scrollProgress.value *
      maxSlots *
      (parallaxMultiplier / 100) *
      maxParallaxPx;
    return { transform: [{ translateX }] };
  }, [parallaxMultiplier, maxParallaxPx]);
