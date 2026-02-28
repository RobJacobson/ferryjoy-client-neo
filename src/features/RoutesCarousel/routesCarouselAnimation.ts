/**
 * RoutesCarousel animation worklet.
 *
 * Creates 3D scroll-driven animations (opacity, scale, rotate, zIndex).
 * Runs on UI thread for smooth 60fps performance.
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
 *
 * Animation values based on distance from center:
 * - Centered (distance 0): opacity=1, scale=1, rotate=0°, zIndex=10
 * - Adjacent (distance 1): opacity=0.5, scale=0.75, rotate=±45°, zIndex=9
 * - Distant (distance 2+): opacity=0.1-0.3, scale=0.75, rotate=±45°, zIndex=0-8
 *
 * @param scrollIndex - Shared value of current scroll position (normalized to index)
 * @param index - Index of current item
 * @param layout - Layout configuration (unused, kept for API compatibility)
 * @returns Animated style object with opacity, transform, and zIndex
 */
export const routesCarouselAnimation = (
  scrollIndex: SharedValue<number>,
  index: number,
  _layout: AnimatedListLayout
): AnimatedStyleResult => {
  "worklet";

  const distance = distanceFromIndex(index, scrollIndex.value);

  // Z-index based on distance (centered item on top)
  const zIndex = Math.round(
    interpolate(distance, [0, 10], [10, 0], Extrapolation.CLAMP)
  );

  // 7-point interpolation for smooth fade across 6 items
  const opacity = interpolate(
    scrollIndex.value,
    [index - 3, index - 2, index - 1, index, index + 1, index + 2, index + 3],
    [0.1, 0.3, 0.5, 1, 0.5, 0.3, 0.1],
    Extrapolation.CLAMP
  );

  // 3-point interpolation for subtle depth effect
  const scale = interpolate(
    scrollIndex.value,
    [index - 1, index, index + 1],
    [0.75, 1, 0.75],
    Extrapolation.CLAMP
  );

  // 3-point interpolation for fan-like rotation effect
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
