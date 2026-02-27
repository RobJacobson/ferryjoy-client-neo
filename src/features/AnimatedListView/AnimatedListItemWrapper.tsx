/**
 * AnimatedListItemWrapper – Generic wrapper component that applies
 * scroll-driven animations to any content. Separates animation logic
 * from rendering, allowing maximum flexibility for item content.
 */

import type { PropsWithChildren } from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { AnimatedListViewLayout } from "./types";
import { calculateDistanceFromActive } from "./utils";

type AnimatedListItemWrapperProps = PropsWithChildren<{
  index: number;
  scrollIndex: SharedValue<number>;
  layout: AnimatedListViewLayout;
}>;

/**
 * Wrapper component that applies default scroll-driven animations
 * to any child content. Uses fade and scale effects based on distance
 * from the active (centered) item.
 *
 * @param index - Index of the item in the list
 * @param scrollIndex - Shared value of current scroll position (normalized to index)
 * @param layout - Layout configuration for the list
 * @param children - Child content to render with applied animations
 */
const AnimatedListItemWrapper = ({
  index,
  scrollIndex,
  layout,
  children,
}: AnimatedListItemWrapperProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    const currentScrollIndex = scrollIndex.value;
    const distanceFromActive = calculateDistanceFromActive(
      index,
      currentScrollIndex
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
  });

  return (
    <Animated.View
      style={[animatedStyle, { height: layout.itemSize }]}
      className="w-full overflow-hidden rounded-2xl"
    >
      {children}
    </Animated.View>
  );
};

export default AnimatedListItemWrapper;
