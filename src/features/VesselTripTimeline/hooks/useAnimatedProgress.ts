/**
 * Animated position hook for the overlay indicator.
 * Smooths vertical position updates (e.g. from 5s Convex polls)
 * with an ease-in-out timing animation.
 */

import { useEffect } from "react";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";

const PROGRESS_ANIMATION_DURATION_MS = 5000;

const EASE_IN_OUT_CONFIG = {
  duration: PROGRESS_ANIMATION_DURATION_MS,
  easing: Easing.inOut(Easing.quad),
} as const;

/**
 * Returns a SharedValue that animates to the given numeric position.
 * Callers can opt into immediate jumps at row boundaries; otherwise the
 * value eases smoothly between infrequent data updates.
 *
 * @param value - Target position value, typically an absolute top in pixels
 * @param shouldJump - Whether the value should snap immediately
 * @returns SharedValue<number> for use with useAnimatedStyle in TimelineIndicator
 */
export const useAnimatedProgress = (value: number, shouldJump = false) => {
  const animatedProgress = useSharedValue(value);

  useEffect(() => {
    if (shouldJump) {
      animatedProgress.value = value;
    } else {
      animatedProgress.value = withTiming(value, EASE_IN_OUT_CONFIG);
    }
  }, [animatedProgress, shouldJump, value]);

  return animatedProgress;
};
