/**
 * Animated position hook for the overlay indicator.
 * Smooths vertical position updates (e.g. from 5s Convex polls)
 * with a Reanimated spring.
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
 * Returns a SharedValue that animates to the given numeric position.
 * Callers can opt into immediate jumps at row boundaries; otherwise the
 * value springs smoothly between infrequent data updates.
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
      animatedProgress.value = withSpring(value, SPRING_CONFIG);
    }
  }, [animatedProgress, shouldJump, value]);

  return animatedProgress;
};
