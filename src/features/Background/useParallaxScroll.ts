// ============================================================================
// useParallaxScroll Hook
// ============================================================================
// Shared animation logic for scroll-driven parallax effects.
// Calculates horizontal translateX based on carousel scroll position and
// parallax multiplier (0-100). Farther layers use lower multipliers.
// ============================================================================

import type { SharedValue } from "react-native-reanimated";
import { useAnimatedStyle } from "react-native-reanimated";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for useParallaxScroll hook.
 */
interface UseParallaxScrollProps {
  /**
   * Shared scroll offset (x) from carousel.
   */
  scrollX: SharedValue<number>;

  /**
   * Width of one carousel slot.
   */
  slotWidth: number;

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
 * Returns an animated style that applies horizontal translation based on scroll position,
 * parallax multiplier, and maximum parallax pixels. The layer translates left
 * when scrolling right, creating a depth effect for multi-layered backgrounds.
 * Returns zero translation when slotWidth is 0 (initial render).
 *
 * @param scrollX - Shared scroll offset (x) value from carousel
 * @param slotWidth - Width of one carousel slot in pixels
 * @param parallaxMultiplier - Parallax strength (0-100), higher values create more movement
 * @param maxParallaxPx - Maximum parallax movement in pixels, computed from screen orientation
 * @returns Animated style object with translateX transform for scroll-driven parallax effect
 *
 * @example
 * ```tsx
 * const parallaxStyle = useParallaxScroll({
 *   scrollX,
 *   slotWidth,
 *   parallaxMultiplier: 8,
 *   maxParallaxPx,
 * });
 *
 * return <Animated.View style={parallaxStyle}>Content</Animated.View>;
 * ```
 */
export const useParallaxScroll = ({
  scrollX,
  slotWidth,
  parallaxMultiplier,
  maxParallaxPx,
}: UseParallaxScrollProps) =>
  useAnimatedStyle(() => {
    if (slotWidth === 0) {
      return { transform: [{ translateX: 0 }] };
    }
    const progress = scrollX.value / slotWidth;
    const translateX = -progress * (parallaxMultiplier / 100) * maxParallaxPx;
    return { transform: [{ translateX }] };
  }, [slotWidth, parallaxMultiplier, maxParallaxPx]);
