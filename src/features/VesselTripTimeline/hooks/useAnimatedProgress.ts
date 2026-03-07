/**
 * Animated progress hook for the overlay indicator.
 * Smooths position updates (e.g. from 5s Convex polls) with a Reanimated spring.
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
 * Jumps immediately at 0 or 1 to avoid overshoot at segment boundaries;
 * uses spring for intermediate values so the indicator moves smoothly
 * between infrequent data updates.
 *
 * @param progress - Progress value between 0 and 1 (from deriveOverlayIndicator)
 * @returns SharedValue<number> for use with useAnimatedStyle in TimelineIndicator
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
