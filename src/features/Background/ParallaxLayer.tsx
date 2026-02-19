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
   * Shared scroll offset (x) from the carousel.
   */
  scrollX: SharedValue<number>;

  /**
   * Width of one carousel slot in pixels.
   */
  slotWidth: number;

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
 * @param props - scrollX, slotWidth, parallaxMultiplier, maxParallaxPx, style, children
 * @returns Parallax-translated Animated.View wrapper
 */
export const ParallaxLayer = ({
  scrollX,
  slotWidth,
  parallaxMultiplier,
  maxParallaxPx,
  style,
  children,
}: ParallaxLayerProps) => {
  const parallaxStyle = useParallaxScroll({
    scrollX,
    slotWidth,
    parallaxMultiplier,
    maxParallaxPx,
  });

  return (
    <Animated.View style={[parallaxStyle, style]}>{children}</Animated.View>
  );
};
