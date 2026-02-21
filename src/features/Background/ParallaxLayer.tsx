// ============================================================================
// ParallaxLayer
// ============================================================================
// Shared wrapper for scroll-driven parallax translation.
// Used by background layers (Sky, Waves, etc.) to apply translateX based on
// carousel scroll position and a 0–100 parallax multiplier.
// ============================================================================

import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { useParallaxScroll } from "./useParallaxScroll";

// ============================================================================
// Types
// ============================================================================

type ParallaxLayerProps = {
  /**
   * Shared scroll progress (0 = first item, 1 = last item).
   */
  scrollProgress: SharedValue<number>;

  /**
   * Parallax multiplier (0–100). Higher values create more movement.
   */
  parallaxMultiplier: number;

  /**
   * Maximum parallax movement in pixels (orientation-aware).
   */
  maxParallaxPx: number;

  /**
   * Additional style(s) for the layer container.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Child content to be translated by the parallax transform.
   */
  children?: ReactNode;
};

// ============================================================================
// ParallaxLayer
// ============================================================================

/**
 * Applies scroll-driven translateX to its children.
 *
 * @param scrollProgress - Shared scroll progress (0 = first item, 1 = last item)
 * @param parallaxMultiplier - Parallax multiplier (0-100), higher values create more movement
 * @param maxParallaxPx - Maximum parallax movement in pixels
 * @param style - Additional style(s) for the layer container
 * @param children - Child content to be translated by the parallax transform
 * @returns Parallax-translated Animated.View wrapper
 */
export const ParallaxLayer = ({
  scrollProgress,
  parallaxMultiplier,
  maxParallaxPx,
  style,
  children,
}: ParallaxLayerProps) => {
  const parallaxStyle = useParallaxScroll({
    scrollProgress,
    parallaxMultiplier,
    maxParallaxPx,
  });

  return (
    <Animated.View style={[parallaxStyle, style]}>{children}</Animated.View>
  );
};
