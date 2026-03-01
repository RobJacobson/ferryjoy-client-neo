// ============================================================================
// ParallaxLayer
// ============================================================================
// Shared wrapper for scroll-driven parallax translation. Uses scroll progress
// (0-1) and parallax width (px) for translateX. Gets scrollProgress from
// ParallaxProvider context when prop omitted.
// ============================================================================

import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useParallaxContext } from "./ParallaxContext";

// ============================================================================
// Types
// ============================================================================

type ParallaxLayerProps = {
  /**
   * Shared scroll progress (0 = first item, 1 = last item). Optional when
   * inside ParallaxProvider.
   */
  scrollProgress?: SharedValue<number>;

  /**
   * Parallax width: how far this layer translates (px) when scroll progress
   * goes from 0 to 1. Higher = faster parallax.
   */
  parallaxWidth: number;

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
 * @param scrollProgress - Shared scroll progress (0-1). Optional when inside ParallaxProvider.
 * @param parallaxWidth - How far layer translates when progress = 1 (px)
 * @param style - Additional style(s) for the layer container
 * @param children - Child content to be translated
 * @returns Parallax-translated Animated.View wrapper
 */
export const ParallaxLayer = ({
  scrollProgress: scrollProgressProp,
  parallaxWidth,
  style,
  children,
}: ParallaxLayerProps) => {
  const contextScrollProgress = useParallaxContext();
  const defaultScrollProgress = useSharedValue(0);
  const scrollProgress =
    scrollProgressProp ?? contextScrollProgress ?? defaultScrollProgress;

  const parallaxStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: -scrollProgress.value * parallaxWidth }],
    }),
    [parallaxWidth]
  );

  return (
    <Animated.View style={[parallaxStyle, style]}>{children}</Animated.View>
  );
};
