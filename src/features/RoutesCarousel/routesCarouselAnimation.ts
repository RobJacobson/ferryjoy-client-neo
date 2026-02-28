/**
 * RoutesCarousel animation worklet.
 * Extracts scroll-driven animation logic for use with AnimatedList.
 * Provides opacity, scale, rotate, and zIndex animations based on scroll position.
 */

import type { SharedValue } from "react-native-reanimated";
import { Extrapolation, interpolate } from "react-native-reanimated";
import type {
  AnimatedListLayout,
  AnimatedStyleResult,
} from "@/features/AnimatedList/types";
import { distanceFromIndex } from "../AnimatedList/utils";

/**
 * Scroll-driven animation style for RoutesCarousel items.
 * Applies opacity, scale, rotate, and zIndex based on distance from active item.
 * Used as itemAnimationStyle prop for AnimatedList.
 *
 * @param scrollIndex - Shared value of current scroll position (normalized to index)
 * @param index - Index of the current item
 * @param layout - Layout configuration for the list (unused, kept for API compatibility)
 * @returns Animated style object with opacity, transform, and zIndex
 */
export const routesCarouselAnimation = (
  scrollIndex: SharedValue<number>,
  index: number,
  _layout: AnimatedListLayout
): AnimatedStyleResult => {
  "worklet";

  const distance = distanceFromIndex(index, scrollIndex.value);

  const zIndex = Math.round(
    interpolate(distance, [0, 10], [10, 0], Extrapolation.CLAMP)
  );

  const opacity = interpolate(
    scrollIndex.value,
    [index - 3, index - 2, index - 1, index, index + 1, index + 2, index + 3],
    [0.1, 0.3, 0.5, 1, 0.5, 0.3, 0.1],
    Extrapolation.CLAMP
  );

  const scale = interpolate(
    scrollIndex.value,
    [index - 1, index, index + 1],
    [0.75, 1, 0.75],
    Extrapolation.CLAMP
  );

  const rotate = interpolate(
    scrollIndex.value,
    [index - 1, index, index + 1],
    [45, 0, -45],
    Extrapolation.CLAMP
  );

  return {
    opacity,
    transform: [{ scale }, { rotate: `${rotate}deg` }],
    zIndex,
  };
};
