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
  /**
   * Item index in the carousel list.
   * Used to calculate animated styles based on scroll position.
   */
  index: number;
  /**
   * Shared scroll value normalized to index (scrollOffset / snapInterval).
   * A value of 2.5 means the carousel is scrolled 2.5 slots from the start.
   */
  scrollX: SharedValue<number>;
  /** Width of the carousel slot in pixels. */
  width: number;
  /** Height of the carousel slot in pixels. */
  height: number;
  /** Accessibility label for the item (used by screen readers). */
  accessibilityLabel: string;
};

// ============================================================================
// RoutesCarouselItem
// ============================================================================

/**
 * Wrapper that applies animated style to a carousel item from scroll position.
 * Uses opacity, scale, rotate, and zIndex for the active-item effect.
 *
 * @param index - Item index in the carousel list
 * @param scrollX - Shared scroll value normalized to index
 * @param width - Width of the carousel slot in pixels
 * @param height - Height of the carousel slot in pixels
 * @param accessibilityLabel - Accessibility label for the item
 * @param children - Child content to render
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
        [index - 2, index, index + 2],
        [0, 10, 0],
        Extrapolation.CLAMP
      )
    ),
  }));
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [index - 1, index, index + 1],
      [0.1, 1, 0.1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          [index - 1, index, index + 1],
          [0.75, 1, 0.75],
          Extrapolation.CLAMP
        ),
      },
      {
        rotate: `${interpolate(
          scrollX.value,
          [index - 1, index, index + 1],
          [15, 0, -15],
          Extrapolation.CLAMP
        )}deg`,
      },
    ],
  }));

  return (
    <Animated.View
      className="relative"
      style={[
        { width, height },
        { scrollSnapAlign: "center", overflow: "hidden" } as ViewStyle,
        zIndexStyle,
        animatedStyle,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ width, height }}>{children}</View>
    </Animated.View>
  );
};
