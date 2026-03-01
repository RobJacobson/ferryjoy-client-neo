// ============================================================================
// ParallaxLayer
// ============================================================================
// Shared wrapper for scroll-driven parallax translation. Uses scroll progress
// (0-1) from ParallaxProvider context and parallax width (px) for translateX.
// ============================================================================

import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
} from "react-native-reanimated";
import { useParallaxContext } from "./ParallaxContext";

// ============================================================================
// Types
// ============================================================================

type ParallaxLayerProps = {
  /**
   * Parallax distance: how far this layer translates (px) when scroll progress
   * goes from 0 to 1. Higher = faster parallax.
   */
  parallaxDistance: number;

  /** Additional style(s) for the layer container. */
  style?: StyleProp<ViewStyle>;

  /** Child content to be translated by the parallax transform. */
  children?: ReactNode;
};

// ============================================================================
// ParallaxLayer
// ============================================================================

/**
 * Applies scroll-driven translateX to its children.
 *
 * Coordinate system:
 * - Layer starts at x=0 (left-aligned to viewport)
 * - As scrollProgress goes 0→1, layer translates LEFT
 * - translateX = -scrollProgress × parallaxDistance
 * - Layer must extend right to cover: screenWidth + parallaxDistance
 *
 * @param parallaxDistance - How far layer translates when progress = 1 (px)
 * @param style - Additional style(s) for the layer container
 * @param children - Child content to be translated
 * @returns Parallax-translated Animated.View wrapper
 */
export const ParallaxLayer = ({
  parallaxDistance,
  style,
  children,
}: ParallaxLayerProps) => {
  const scrollProgress = useParallaxContext();

  const parallaxStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: -scrollProgress.value * parallaxDistance }],
    }),
    [parallaxDistance]
  );

  return (
    <Animated.View style={[parallaxStyle, style]}>{children}</Animated.View>
  );
};
