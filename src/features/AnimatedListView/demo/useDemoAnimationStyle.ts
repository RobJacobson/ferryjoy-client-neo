/**
 * Demo animation hook for AnimatedListView demo.
 * Applies fade and scale effects based on distance from the active item.
 */

import type { SharedValue } from "react-native-reanimated";
import { Extrapolation, interpolate } from "react-native-reanimated";
import type { AnimatedListViewLayout, AnimatedStyleResult } from "../types";
import { calculateDistanceFromActive } from "../utils";

/**
 * Demo animation style hook that applies fade and scale effects.
 * Items closer to the active (centered) position appear more prominent.
 *
 * @param scrollIndex - Shared value of current scroll position (normalized to index)
 * @param index - Index of the current item
 * @param layout - Layout configuration for the list
 * @returns Animated style object with opacity and scale transform
 */
const useDemoAnimationStyle: (
  scrollIndex: SharedValue<number>,
  index: number,
  layout: AnimatedListViewLayout
) => AnimatedStyleResult = (scrollIndex, index) => {
  "worklet";
  const distanceFromActive = calculateDistanceFromActive(
    index,
    scrollIndex.value
  );

  return {
    opacity: interpolate(
      distanceFromActive,
      [0, 1, 2],
      [1, 0.6, 0.3],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          distanceFromActive,
          [0, 1, 2],
          [1.0, 0.95, 0.9],
          Extrapolation.CLAMP
        ),
      },
    ],
  };
};

export default useDemoAnimationStyle;
