/**
 * Single carousel item wrapper with scroll-driven animations.
 * Applies zIndex, opacity, scale, and rotate based on scroll position.
 */

import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

// ============================================================================
// Types
// ============================================================================

type RoutesCarouselItemProps = {
  /** Item index in the list. */
  index: number;
  /** Shared scroll value (normalized to index, e.g. scrollOffset / snapInterval). */
  scrollX: SharedValue<number>;
  /** Width of the carousel slot. */
  width: number;
  /** Height of the carousel slot. */
  height: number;
  /** Accessibility label for the item. */
  accessibilityLabel: string;
};

// ============================================================================
// RoutesCarouselItem
// ============================================================================

/**
 * Wrapper that applies animated style to a carousel item from scroll position.
 * Uses opacity, scale, rotate, and zIndex for the active-item effect.
 *
 * @param props - index, scrollX, width, height, accessibilityLabel, children
 */
export const RoutesCarouselItem = ({
  index,
  scrollX,
  width,
  height,
  accessibilityLabel,
  children,
}: PropsWithChildren<RoutesCarouselItemProps>) => {
  const zIndexStyle = useAnimatedStyle(() => ({
    zIndex: Math.round(
      interpolate(
        scrollX.value,
        [index - 1, index, index + 1],
        [0, 10, 0],
        Extrapolation.CLAMP,
      ),
    ),
  }));
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [index - 0.5, index, index + 0.5],
      [0.0, 1, 0.0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          [index - 1, index, index + 1],
          [0.75, 1, 0.75],
          Extrapolation.CLAMP,
        ),
      },
      {
        rotate: `${interpolate(
          scrollX.value,
          [index - 1, index, index + 1],
          [15, 0, -15],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));

  return (
    <Animated.View
      className="relative"
      style={[
        { width, height },
        { scrollSnapAlign: "center", overflow: "visible" } as ViewStyle,
        zIndexStyle,
        animatedStyle,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ width, height }}>{children}</View>
    </Animated.View>
  );
};
