/**
 * Smoothly animates a scalar toward a new target (indicator vertical position).
 */

import { useEffect } from "react";
import { useSharedValue, withSpring } from "react-native-reanimated";

const GRADUAL_SPRING_CONFIG = {
  damping: 120,
  stiffness: 4,
  mass: 16,
  overshootClamping: true,
} as const;

/**
 * Drives a shared value with a gradual spring whenever `value` changes.
 *
 * @param value - Next target (e.g. indicator `top` in pixels)
 * @returns Reanimated shared value reflecting the spring transition
 */
export const useAnimatedProgress = (value: number) => {
  const animatedProgress = useSharedValue(value);

  useEffect(() => {
    animatedProgress.value = withSpring(value, GRADUAL_SPRING_CONFIG);
  }, [animatedProgress, value]);

  return animatedProgress;
};
