/**
 * Shared animated progress hook for timeline bars and indicators.
 * Jumps at 0/1 to avoid initial glitch; uses spring for intermediate values.
 */

import { useEffect } from "react";
import { useSharedValue, withSpring } from "react-native-reanimated";

const SPRING_CONFIG = {
  damping: 100,
  stiffness: 2,
  mass: 5,
  overshootClamping: true,
} as const;

/**
 * Returns a SharedValue that animates to the given progress value.
 * Jumps immediately at 0 or 1; uses spring animation for values in between.
 *
 * @param progress - Progress value between 0 and 1
 * @returns SharedValue<number> for use with TimelineBar, TimelineIndicator, etc.
 */
export const useAnimatedProgress = (progress: number) => {
  const animatedProgress = useSharedValue(progress);

  useEffect(() => {
    if (progress === 1 || progress === 0) {
      animatedProgress.value = progress;
    } else {
      animatedProgress.value = withSpring(progress, SPRING_CONFIG);
    }
  }, [progress, animatedProgress]);

  return animatedProgress;
};
